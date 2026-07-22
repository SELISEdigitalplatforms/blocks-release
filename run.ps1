param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CliArgs
)

# ---- Usage ----
function Show-Usage {
@"
Usage: .\run.ps1 [OPTIONS]

Options:
  -b, --backend        Run .NET API
  -w, --worker         Run .NET Worker
  -a, --all            Build frontend + run API + Worker
  -f, --frontend       Run frontend (npm run dev)

  -n, --npm <args>     Run npm command (client/)
  -d, --dotnet <args>  Run dotnet CLI command

  -k, --kill-port      Kill process on API port
  -h, --help           Show this help

Tests:
  -te, --test-e2e      End-to-end tests (e2e/: playwright)
"@ | Write-Host
}

# ---- Flags ----
$Backend = $false
$Worker = $false
$All = $false
$Frontend = $false
$KillPort = $false
$TestE2e = $false
$Npm = @()
$Dotnet = @()

# ---- Parse args ----
$i = 0
while ($i -lt $CliArgs.Count) {
    switch ($CliArgs[$i]) {

        "-b" { $Backend = $true }
        "--backend" { $Backend = $true }

        "-w" { $Worker = $true }
        "--worker" { $Worker = $true }

        "-a" { $All = $true }
        "--all" { $All = $true }

        "-f" { $Frontend = $true }
        "--frontend" { $Frontend = $true }

        "-k" { $KillPort = $true }
        "--kill-port" { $KillPort = $true }

        "-te" { $TestE2e = $true }
        "--test-e2e" { $TestE2e = $true }

        "-h" { Show-Usage; exit }
        "--help" { Show-Usage; exit }

        "-n" { $i++; while ($i -lt $CliArgs.Count -and $CliArgs[$i] -notmatch "^-") { $Npm += $CliArgs[$i]; $i++ }; $i-- }
        "--npm" { $i++; while ($i -lt $CliArgs.Count -and $CliArgs[$i] -notmatch "^-") { $Npm += $CliArgs[$i]; $i++ }; $i-- }

        "-d" { $i++; while ($i -lt $CliArgs.Count -and $CliArgs[$i] -notmatch "^-") { $Dotnet += $CliArgs[$i]; $i++ }; $i-- }
        "--dotnet" { $i++; while ($i -lt $CliArgs.Count -and $CliArgs[$i] -notmatch "^-") { $Dotnet += $CliArgs[$i]; $i++ }; $i-- }

        default {
            Write-Host "Unknown option: $($CliArgs[$i])"
            Show-Usage
            exit 1
        }
    }
    $i++
}

if (-not ($Backend -or $Worker -or $All -or $Frontend -or $KillPort -or $TestE2e -or $Npm.Count -or $Dotnet.Count)) {
    Show-Usage
    exit
}

# ---- Paths ----
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ClientDir = Join-Path $ScriptDir "client"
$E2eDir = Join-Path $ScriptDir "e2e"
$ApiProject = Join-Path $ScriptDir "server/Api/Api.csproj"
$WorkerProject = Join-Path $ScriptDir "server/Worker/Worker.csproj"
$Wwwroot = Join-Path $ScriptDir "server/Api/wwwroot"

$ApiPort = 5000

# ---- Helpers ----

function Free-Port {
    $connections = netstat -ano | Select-String ":$ApiPort"
    foreach ($line in $connections) {
        $parts = ($line -split "\s+") | Where-Object { $_ }
        $pid = $parts[-1]
        if ($pid -match "^\d+$") {
            Write-Host "Killing PID $pid on port $ApiPort"
            taskkill /PID $pid /F | Out-Null
        }
    }
}

function Restore-Dotnet {
    Write-Host "Restoring .NET dependencies..."
    dotnet restore $ApiProject
    dotnet restore $WorkerProject
}

function Build-Frontend {
    Write-Host "Building frontend..."
    npm --prefix $ClientDir install
    npm --prefix $ClientDir run build

    if (!(Test-Path $Wwwroot)) {
        New-Item -ItemType Directory -Path $Wwwroot | Out-Null
    }

    if (Test-Path "$ClientDir/dist") {
        Write-Host "Syncing dist → wwwroot..."
        robocopy "$ClientDir/dist" $Wwwroot /MIR | Out-Null
    }
}

# HTTPS is driven by the machine env vars RELEASE_SSL_CERT / RELEASE_SSL_KEY.
# Both set + both files present -> HTTPS on $ApiPort; otherwise -> HTTP (fallback).
function Set-BackendTls {
    if ($env:RELEASE_SSL_CERT -and $env:RELEASE_SSL_KEY `
        -and (Test-Path $env:RELEASE_SSL_CERT) -and (Test-Path $env:RELEASE_SSL_KEY)) {
        $env:Kestrel__Certificates__Default__Path    = $env:RELEASE_SSL_CERT
        $env:Kestrel__Certificates__Default__KeyPath = $env:RELEASE_SSL_KEY
        $env:ASPNETCORE_URLS = "https://0.0.0.0:$ApiPort"
        Write-Host "Backend TLS: HTTPS on $ApiPort"
    } else {
        $env:ASPNETCORE_URLS = "http://0.0.0.0:$ApiPort"
        Write-Host "Backend TLS: cert env not set/found - HTTP on $ApiPort"
    }
}

function Run-Backend {
    Set-BackendTls
    Write-Host "Running .NET API..."
    # --urls on the command line outranks the launchSettings.json applicationUrl,
    # which would otherwise override the ASPNETCORE_URLS set in Set-BackendTls.
    dotnet run --project $ApiProject -- --urls $env:ASPNETCORE_URLS
}

function Run-Worker {
    Write-Host "Running .NET Worker..."
    dotnet run --project $WorkerProject
}

# ---- Tests ----

# Native commands do not stop the script on failure, so check the exit code.
function Invoke-Step {
    param([scriptblock]$Step, [string]$Name)

    & $Step
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$Name failed (exit $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
}

# Reads e2e/.env.e2e for the target host + credentials. Against the remote dev
# host that file sets E2E_NO_WEBSERVER=1; without it Playwright would try to
# start a local API itself (webServer: run.sh -b).
function Test-E2E {
    Write-Host "=== E2E tests ==="

    if (!(Test-Path (Join-Path $E2eDir ".env.e2e"))) {
        Write-Host "Missing $E2eDir\.env.e2e - copy .env.e2e.example and set E2E_BASE_URL + credentials."
        exit 1
    }

    if (!(Test-Path (Join-Path $E2eDir "node_modules"))) {
        Write-Host "Installing dependencies in e2e..."
        Invoke-Step { npm --prefix $E2eDir install } "npm install"
    }

    Push-Location $E2eDir
    try {
        Invoke-Step { npx playwright install --no-shell chromium } "playwright install"
        Invoke-Step { npm run test } "e2e tests"
    }
    finally {
        Pop-Location
    }
}

# ---- Execution ----

if ($KillPort) {
    Free-Port
    exit
}

if ($TestE2e) {
    Test-E2E
    exit
}

if ($Dotnet.Count -gt 0) {
    dotnet @Dotnet
    exit
}

if ($Npm.Count -gt 0) {
    npm --prefix $ClientDir @Npm
    exit
}

if ($Backend) {
    Free-Port
    Restore-Dotnet
    Run-Backend
    exit
}

if ($Worker) {
    Restore-Dotnet
    Run-Worker
    exit
}

if ($Frontend) {
    npm --prefix $ClientDir install
    npm --prefix $ClientDir run dev
    exit
}

if ($All) {
    Free-Port
    Restore-Dotnet
    Build-Frontend

    Set-BackendTls

    Write-Host "Starting API + Worker..."

    $api = Start-Process powershell `
        -ArgumentList "-NoExit", "-Command", "dotnet run --project '$ApiProject' -- --urls '$env:ASPNETCORE_URLS'" `
        -PassThru

    $worker = Start-Process powershell `
        -ArgumentList "-NoExit", "-Command", "dotnet run --project '$WorkerProject'" `
        -PassThru

    Write-Host "API PID: $($api.Id)"
    Write-Host "Worker PID: $($worker.Id)"
    Write-Host "Press Enter to stop..."

    [void][Console]::ReadLine()

    try { Stop-Process $api.Id -Force } catch {}
    try { Stop-Process $worker.Id -Force } catch {}
}
