# .NET + Frontend Local Development & Dependency Management Guide

This guide covers all local development workflows for your monorepo using the unified `run.sh` (Linux/macOS) and `run.ps1` (Windows) scripts.

---

## Quick Start

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd <your-project>
```

---

### 2. Backend setup (.NET)

No virtual environment needed. Just restore dependencies:

```bash
dotnet restore server/Api/Api.csproj
dotnet restore server/Worker/Worker.csproj
```

Or using the unified script:

```bash
./run.sh -d restore
```

---

### 3. Frontend setup (Node)

```bash
cd client
cp .env.example .env   # if applicable
npm install
```

---

## Local HTTPS setup (mkcert)

Both the frontend (Vite, port **4000**) and backend (.NET Kestrel, port **5000**) serve HTTPS
under the named domain when **two machine environment variables** point at an mkcert certificate.
If either is unset or its file is missing, **everything falls back to HTTP automatically** — no
errors. This procedure is reusable across projects; only the domain/cert changes.

### One-time, per machine

1. **Install mkcert** and its local CA (the CA is then trusted by Chrome/Edge/OS):

   ```bash
   mkcert -install
   ```

2. **Generate the cert + key** for the domain (pick any stable directory):

   ```bash
   mkcert -cert-file C:/SSL_Certificates/dev-deployment.blocksdevelopers.com.pem \
          -key-file  C:/SSL_Certificates/dev-deployment.blocksdevelopers.com-key.pem \
          dev-deployment.blocksdevelopers.com
   ```

3. **Add a hosts entry** so the domain resolves locally:

   ```
   127.0.0.1 dev-deployment.blocksdevelopers.com
   ```

   - Windows: `C:\Windows\System32\drivers\etc\hosts`
   - macOS/Linux: `/etc/hosts`

4. **Set the two machine env vars** (then restart the terminal/IDE so they're picked up):
   - Windows (PowerShell):

     ```powershell
     setx DEPLOYMENT_SSL_CERT "C:\SSL_Certificates\dev-deployment.blocksdevelopers.com.pem"
     setx DEPLOYMENT_SSL_KEY  "C:\SSL_Certificates\dev-deployment.blocksdevelopers.com-key.pem"
     ```

   - macOS/Linux (add to `~/.bashrc` / `~/.zshrc`):

     ```bash
     export DEPLOYMENT_SSL_CERT="$HOME/.ssl/dev-deployment.blocksdevelopers.com.pem"
     export DEPLOYMENT_SSL_KEY="$HOME/.ssl/dev-deployment.blocksdevelopers.com-key.pem"
     ```

### Behavior

| Both vars set + files exist | Result                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Yes                         | FE `https://dev-deployment.blocksdevelopers.com:4000`, API `https://…:5000` (trusted cert) |
| No                          | FE `http://…:4000`, API `http://…:5000` (automatic fallback)                               |

This applies to every launch method: `npm run dev` (from `client/`), `./run.sh -f|-b|-a`, and the
`run.ps1` equivalents. The frontend reads the vars in `client/vite.config.ts`; the run scripts map
them to Kestrel for the backend. Run the backend via `./run.sh -b|-a` or `run.ps1 -b|-a` (not bare
`dotnet run`, which has no cert mapping and stays HTTP).

> **Reuse for another project:** keep the env var names `DEPLOYMENT_SSL_CERT` /
> `DEPLOYMENT_SSL_KEY` identical; only generate a cert for that project's domain and update the
> hosts entry.

---

## Unified run.sh Script

All development workflows are handled via:

```bash
./run.sh
```

### Available Commands

- `./run.sh -b` or `--backend`
  Run only the .NET API (default port: 5000)

- `./run.sh -w` or `--worker`
  Run only the .NET Worker service

- `./run.sh -f` or `--frontend`
  Run frontend dev server (Vite)

- `./run.sh -a` or `--all`
  Build frontend → run API + Worker together

- `./run.sh -k` or `--kill-port`
  Kill any process using the API port

- `./run.sh -n <args>` or `--npm <args>`
  Run any npm command inside `client/`
  Example:

  ```bash
  ./run.sh -n install
  ./run.sh -n run build
  ```

- `./run.sh -d <args>` or `--dotnet <args>`
  Run any .NET CLI command
  Example:

  ```bash
  ./run.sh -d build
  ./run.sh -d test
  ./run.sh -d add package Serilog
  ```

---

## Dependency Management (Backend - .NET)

Unlike Python, .NET uses built-in tooling.

### Install all dependencies

```bash
./run.sh -d restore
```

---

### Add a new package

```bash
./run.sh -d add server/Api package <PackageName>
```

Example:

```bash
./run.sh -d add server/Api package Serilog
```

---

### Remove a package

```bash
./run.sh -d remove server/Api package <PackageName>
```

---

### Build projects

```bash
./run.sh -d build
```

---

### Run tests (if available)

```bash
./run.sh -d test
```

---

## Dependency Management (Frontend)

Use npm via the script:

```bash
./run.sh -n install
./run.sh -n run dev
./run.sh -n run build
```

Or directly:

```bash
cd client
npm install
```

---

## Windows Users: Important Note

### PowerShell Support

Use:

```powershell
.\run.ps1
```

instead of `run.sh`.

---

### First-time setup

PowerShell blocks scripts by default. Run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

---

### Recommended usage

- ✅ Use `run.sh` with **Git Bash** (best compatibility)
- ✅ Use `run.ps1` with **PowerShell** (native Windows)

---

## Example Local Workflow

```bash
# 1. Restore backend dependencies
./run.sh -d restore

# 2. Install frontend dependencies
./run.sh -n install

# 3. Start backend API
./run.sh -b

# 4. Start frontend
./run.sh -f

# 5. Run worker
./run.sh -w

# 6. Run everything together
./run.sh -a

# 7. Build frontend
./run.sh -n run build

# 8. Add backend dependency
./run.sh -d add server/Api package <PackageName>

# 9. Kill API port
./run.sh -k
```

---

## run.sh Permission (macOS / Linux)

After cloning the repo, if you see `permission denied: ./run.sh`, the execute bit is missing. Fix it with:

```bash
chmod +x run.sh
```

To make this permanent so everyone who clones the repo gets it pre-set:

```bash
git add --chmod=+x run.sh
git commit -m "Make run.sh executable"
```

### Permission reference

| Scenario                         | Command                                   |
| -------------------------------- | ----------------------------------------- |
| Make executable for everyone     | `chmod +x run.sh`                         |
| Make executable for owner only   | `chmod u+x run.sh`                        |
| Set full permissions numerically | `chmod 755 run.sh`                        |
| Check current permissions        | `ls -la run.sh`                           |
| Fix via git (permanent)          | `git add --chmod=+x run.sh && git commit` |

> This applies to **macOS, Linux, and WSL** — they all follow POSIX permission semantics.

---

## Notes

- Always use `dotnet restore` (or `./run.sh -d restore`) to install backend dependencies
- Avoid manually editing `.csproj` for packages—use `dotnet add`
- Frontend is fully standard Node/Vite
- `./run.sh -a` is your **full-stack dev command**
- Worker runs independently—make sure required services (DB, queues, etc.) are available
