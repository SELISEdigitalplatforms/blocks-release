# Blocks Deployment

**Blocks Deployment** is the Blocks cloud console: a **React 18** single-page application (Vite, TypeScript, Tailwind) paired with an **ASP.NET Core** host (`server/Api`) that serves the built SPA from `wwwroot`, exposes JSON APIs, registers **Swagger**, and adds **health checks** to DI (`AddHealthChecks()` in `Program.cs`; HTTP mapping may come from **SeliseBlocks.Genesis** middleware). A separate **.NET Worker** (`server/Worker`) runs message consumers and background work using the same domain services and **SeliseBlocks.Genesis** configuration stack. In production-style runs, the UI and API share one origin (static files + fallback to `index.html`); during local SPA development, Vite serves the app on port **4000** and can proxy selected paths to a backend URL when `BLOCKS_API_BASE_URL` is set.

## Project structure

```text
blocks-deployment/
├── client/                    # React SPA (Vite)
│   ├── app/                   # Application routes, IDP, cross-modules (deployment, lmt, …)
│   ├── public/                # Static assets copied into the build
│   ├── index.html             # SPA shell; __BLOCKS_*__ placeholders for publish-time injection
│   ├── vite.config.ts         # build outDir, dev server, BLOCKS_ env prefix, dev proxies
│   ├── package.json
│   └── .env.example           # BLOCKS_* keys for local dev (copy → .env)
├── server/
│   ├── Api/                   # Web host (Kestrel)
│   │   ├── Controllers/       # MVC API controllers
│   │   ├── wwwroot/           # Published SPA output (Vite build target)
│   │   ├── Program.cs         # Startup, static files, SPA fallback, runtime env injection
│   │   └── Properties/launchSettings.json
│   ├── Worker/                # Worker host + consumers
│   ├── *.DomainService/       # Domain logic (IAM, DevOps, Identifier, MFA, …)
│   ├── Cloud.LmtService/      # LMT / trace-related services
│   ├── Blocks.slnx            # Solution (SDK-style XML)
│   ├── Directory.Build.props  # Shared MSBuild properties (e.g. TargetFramework)
│   └── Directory.Packages.props
├── Dockerfile                 # Multi-stage: Node builds client → dotnet publish Api
├── Dockerfile.worker          # Worker image
├── run.sh                     # macOS/Linux helper
├── run.ps1                    # Windows helper
├── LOCAL_GUIDE.md             # Additional notes (verify flags against scripts)
└── LICENSE
```

## Prerequisites

| Requirement                       | Source in repo                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| **.NET SDK** matching **net10.0** | `server/Directory.Build.props` (`TargetFramework`)                                       |
| **Node.js + npm** for the client  | `client/package.json`; root `Dockerfile` uses **Node 22** for `npm ci` / `npm run build` |
| **PowerShell** (Windows script)   | `run.ps1`                                                                                |

There is **no** `docker-compose` file in this repository. Container builds use the root `Dockerfile` / `Dockerfile.worker`.

## Local infrastructure (optional)

This repository does **not** embed Compose files or hard-require an external infra checkout. If you run against databases, messaging, or other dependencies that your team provisions with Docker Compose, use the companion repo **[blocks-infra](https://github.com/SELISEdigitalplatforms/blocks-infra)** and follow **its** README (for example `docker compose up` or whatever that project documents) before or alongside this application.

## How to run

### Flag reference (shared concepts)

| Flag                 | Bash `run.sh`     | PowerShell `run.ps1` | Behavior                                                                                       |
| -------------------- | ----------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `-a` / `--all`       | Yes               | Yes                  | Build the client, then start **API + Worker** (no Vite dev server).                            |
| `-b` / `--backend`   | Yes               | Yes                  | Run the **API** only (`dotnet run` on `server/Api/Api.csproj`). Frees **API port 5002** first. |
| `-w` / `--worker`    | Yes               | Yes                  | Run the **Worker** only (`dotnet run` on `server/Worker/Worker.csproj`).                       |
| `-f` / `--frontend`  | Yes               | Yes                  | Install deps if needed, then **`npm run dev`** in `client/` (Vite on **4000**).                |
| `-k` / `--kill-port` | Yes               | Yes                  | Free processes listening on **API port 5002** (not the Vite port).                             |
| `-n` / `--npm`       | Yes               | Yes                  | Run `npm` in `client/` with the remaining arguments (e.g. `-n install`).                       |
| `-d` / `--dotnet`    | **No**            | Yes                  | **PowerShell only:** pass through to `dotnet` (e.g. `.\run.ps1 -d restore`).                   |
| `-h` / `--help`      | Yes (via `usage`) | Yes                  | Show usage.                                                                                    |

**Default ports**

- API: **5002** (hard-coded in both scripts; matches `server/Api/Properties/launchSettings.json` `applicationUrl`).
- Vite dev: **4000** (`client/package.json` → `vite --port 4000` and `vite.config.ts` `server.port`).

`launchSettings.json` is what Visual Studio / `dotnet run` use from the IDE; keep it in mind if your IDE profile differs from the scripts.

**Local HTTPS:** both the Vite dev server (4000) and the API (5002) serve HTTPS automatically when the machine env vars `DEPLOYMENT_SSL_CERT` / `DEPLOYMENT_SSL_KEY` point at an mkcert cert; otherwise they fall back to HTTP. One-time setup is documented in **[LOCAL_GUIDE.md → "Local HTTPS setup (mkcert)"](LOCAL_GUIDE.md)**.

### Unix (`run.sh`)

- **Backend:** clears port 5002, runs `dotnet run` (no explicit `dotnet restore`).
- **Frontend:** if `client/node_modules` is missing, runs `npm clean-install`; otherwise runs `npm run dev`. Frees port **4000** with `lsof` (or falls back to `netstat`/`taskkill` on some environments).
- **All (`-a`):** `npm install` + `npm run build` in `client/`, then copies **`client/dist` → `server/Api/wwwroot`** only if `client/dist` exists (`rsync` if available, else `rm` + `cp`). In this repo, **`client/vite.config.ts` sets `build.outDir` to `../server/Api/wwwroot`**, so the production build usually writes **directly** to `wwwroot` and the `dist` sync may not run.
- **All:** runs API and Worker as **background jobs** in the same shell; `trap` kills them on exit.
- **Worker:** foreground `dotnet run` for the Worker project.

> **Note:** [LOCAL_GUIDE.md](LOCAL_GUIDE.md) may describe extra workflows; **`run.sh` in this repo has no `-d` flag** (use `dotnet` directly, or `run.ps1 -d` on Windows).

Examples:

```bash
chmod +x run.sh   # once, if needed
./run.sh -f       # Vite on http://localhost:4000
./run.sh -b       # API on http://localhost:5002
./run.sh -w       # Worker
./run.sh -a       # build SPA + API + Worker
./run.sh -k       # clear port 5002
./run.sh -n ci    # npm ci in client/
```

Restore example (no `-d` in Bash):

```bash
dotnet restore server/Api/Api.csproj
dotnet restore server/Worker/Worker.csproj
```

### Windows (`run.ps1`)

- **`-b` / `-w` / `-a`:** runs **`dotnet restore`** on both Api and Worker before `dotnet run`.
- **Frontend:** `npm --prefix client install` then `npm run dev`.
- **All (`-a`):** `Build-Frontend` uses **`robocopy client\dist` → `server\Api\wwwroot` /MIR** only if `client\dist` exists; same note as above about Vite writing straight to `wwwroot`.
- **All:** starts API and Worker in **separate PowerShell windows** (`Start-Process`); the script waits for **Enter** then stops those processes.
- **`-d`:** runs `dotnet` with the collected arguments from the repo root (e.g. `.\run.ps1 -d restore`).

Examples:

```powershell
.\run.ps1 -f
.\run.ps1 -b
.\run.ps1 -w
.\run.ps1 -a
.\run.ps1 -k
.\run.ps1 -n install
.\run.ps1 -d restore
```

## Without the scripts

**Client**

```bash
cd client
cp .env.example .env   # optional; set BLOCKS_* as needed
npm install
npm run dev              # Vite, port 4000
npm run build            # output: server/Api/wwwroot (see vite.config.ts)
```

**API**

```bash
cd /path/to/blocks-deployment
dotnet restore server/Api/Api.csproj
dotnet run --project server/Api/Api.csproj
```

**Worker**

```bash
dotnet restore server/Worker/Worker.csproj
dotnet run --project server/Worker/Worker.csproj
```

**Solution**

```bash
dotnet build server/Blocks.slnx
```

## Client environment (`BLOCKS_*`)

Copy `client/.env.example` to `client/.env`. Vite loads variables prefixed with **`BLOCKS_`** (`envPrefix` in `client/vite.config.ts`); use `import.meta.env.BLOCKS_*` in code. The example file documents the same keys.

| Variable                      | Role                                                                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLOCKS_APP_URL`              | Public app origin; surfaced at runtime via `window.__BLOCKS_ENV__` / `import.meta.env` (see `client/app/lib/runtime-env.ts`, `client/index.html`).                                                                                        |
| `BLOCKS_API_BASE_URL`         | Base URL for API calls; in **`npm run dev`**, when set, enables the **`server.proxy`** rules in `client/vite.config.ts` (paths such as `/api`, `/cloudbuild`, `/idp`, …). Used in `client/app/lib/get-api-path.ts` for composed API URLs. |
| `BLOCKS_X_BLOCKS_KEY`         | Injected into the published shell for client/runtime use (placeholder replacement on the server).                                                                                                                                         |
| `BLOCKS_GOOGLE_SITE_KEY`      | Injected for captcha-related flows.                                                                                                                                                                                                       |
| `BLOCKS_CONSTRUCT_URL`        | Injected construct/builder URL token.                                                                                                                                                                                                     |
| `BLOCKS_GITHUB_SSO_CLIENT_ID` | Injected GitHub SSO client id.                                                                                                                                                                                                            |

When the API serves a **built** SPA from `wwwroot`, `server/Api/Program.cs` runs **`DotNetEnv.Env.Load()`** and replaces placeholders such as `__BLOCKS_API_BASE_URL__` in `.html`, `.js`, `.css`, and `.json` under `wwwroot` with non-empty environment values. Match those names to deployment secrets or env files on the host.

**Server-only (not in `.env.example`)**

- **`BLOCKS_VAULT_TYPE`:** optional; if set to a valid `VaultType` name, selects the Genesis vault mode. Otherwise `Program.cs` (Api and Worker) uses **OnPrem** when `ASPNETCORE_ENVIRONMENT` / `DOTNET_ENVIRONMENT` is **Development**, else **Azure**.

## Production / publish

1. **Build the SPA** so `server/Api/wwwroot` contains the Vite output (`npm run build` in `client/` per `vite.config.ts`).
2. **Publish the API** (no Node on the runtime server unless you use a raw VM without pre-built assets):

   ```bash
   dotnet publish server/Api/Api.csproj -c Release -o ./publish
   ```

The root **`Dockerfile`** automates this: Node stage builds the client into `server/Api/wwwroot`, then **`mcr.microsoft.com/dotnet/sdk:10.0`** publishes the Api project; the final image is **`mcr.microsoft.com/dotnet/aspnet:10.0-alpine`** (see comments in the Dockerfile for platform `ARG`s). **`Dockerfile.worker`** builds the Worker.

## API / routing

- **Controllers:** `server/Api/Controllers/` (`Api.Controllers` and related namespaces). Routes use attributes such as `[Route("[controller]/[action]")]`; **`GlobalApiRoutePrefixConvention`** in `server/Api/Program.cs` prepends **`api`** to each controller’s attribute route template, so typical controller routes are under **`/api/...`**.
- **Swagger:** `Program.cs` registers Swagger UI (e.g. **`/swagger`**, JSON at **`/swagger/v1/swagger.json`**).
- **Static SPA:** `UseDefaultFiles`, `UseStaticFiles`, and when `wwwroot/index.html` exists, **`MapFallbackToFile("/index.html")`** for client-side routing.
- **Further middleware and endpoints** are applied in **`ApplicationConfigurations.ConfigureMiddleware`** from **SeliseBlocks.Genesis** (referenced via domain packages); use Swagger against a running instance for a complete list beyond this repo’s `Program.cs`.

## License

See [LICENSE](LICENSE).
