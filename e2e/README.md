# Blocks Release End-to-End Tests (Playwright)

E2E tests that drive the real app through the browser, including the dev-iam
login redirect flow.

## One-time setup

1. **Configure env**: copy the template and fill in your values:
   ```bash
   cd e2e
   cp .env.e2e.example .env.e2e
   ```
   Set `E2E_BASE_URL`, `E2E_USERNAME`, `E2E_PASSWORD`. `.env.e2e` is gitignored;
   never commit real credentials.

2. **Install** Playwright + the browser:
   ```bash
   cd e2e
   npm install
   npx playwright install chromium
   ```

## Run

From the repo root:

```bash
./run.sh -te          # or: .\run.ps1 -te
```

That checks `.env.e2e` exists, installs `e2e/node_modules` if missing, ensures
the chromium browser is present, then runs `npm test` inside `e2e/`.

Or directly:

```bash
cd e2e
npm test
```

### Against the remote dev host (default)

With `E2E_BASE_URL=https://dev-release.blocksdeveloper` and
`E2E_NO_WEBSERVER=1` in `.env.e2e`, the tests point straight at the deployed dev
server. Nothing is built or started locally.

You will see this warning on every such run; it is expected and harmless:

```
[e2e] index.html not found at .../server/Api/wwwroot/index.html — skipping BLOCKS_RELEASE_BASE_URL patch.
```

There is no local `wwwroot` to rewrite when the app under test is remote.

### Against a local build

1. Add a hosts entry so the named domain resolves to your machine:
   ```
   127.0.0.1 dev-release.blocksdeveloper
   ```
2. Set `E2E_BASE_URL=https://dev-release.blocksdeveloper:5000` (`5000` is
   `API_PORT` in `run.sh`).
3. Remove (or set to `0`) `E2E_NO_WEBSERVER` so Playwright starts the API itself
   via `bash run.sh -b`. **Git Bash's `bash` must be on PATH** for this;
   `run.ps1 -b` cannot be automated. To manage the server yourself, leave
   `E2E_NO_WEBSERVER=1` and start it in another terminal.
4. Build the frontend at least once (`./run.sh -a`) so
   `server/Api/wwwroot/index.html` exists; `global-setup.ts` rewrites
   `BLOCKS_RELEASE_BASE_URL` in it to point the SPA at your local host instead
   of the remote dev server.

HTTPS on the local host is opt-in: `run.sh` / `run.ps1` serve HTTPS on
`API_PORT` only when both `RELEASE_SSL_CERT` and `RELEASE_SSL_KEY` are set and
point at existing files, and fall back to HTTP otherwise. Match `E2E_BASE_URL`'s
scheme to whichever the startup log reports.

### Other run modes
```bash
npm run test:headed   # watch it in a real browser
npm run test:ui       # Playwright UI mode
npm run report        # open the last HTML report
```

## Discovering / updating selectors

The username/password fields live on the dev-iam page. To capture or verify
selectors against the live page:

```bash
npm run codegen -- <E2E_BASE_URL>/login
```

## Knobs in `.env.e2e`

| Variable | Effect |
|---|---|
| `E2E_BASE_URL` | Host under test. No default; a missing value fails loudly rather than silently hitting localhost. |
| `E2E_USERNAME` / `E2E_PASSWORD` | Dev-IAM test account. Captcha is disabled on dev. |
| `E2E_NO_WEBSERVER=1` | Don't auto-start the app. Required for the remote dev host. |
| `E2E_PAUSE_MS` | How long the browser holds after **each** test so you can see the result. Defaults to **10 s in headed mode**, 0 when headless; `0` disables. |
| `E2E_SLOWMO` | Milliseconds of delay per action, to watch the steps themselves. |
| `E2E_HOLD_MS` | Extra hold at the end of the login spec specifically. |

## Layout

```
e2e/
  tests/auth/login.spec.ts   # setup: dev-iam login + create the run's project in OS
  tests/                     # spec files (run by the chromium project)
  pages/release/console.page.ts
  pages/release/deployment.page.ts
  pages/os/create-project.page.ts
  pages/os/project.page.ts
  support/test-base.ts       # shared `test` with the post-test pause
  support/project-name.ts    # reads the run's project name from fixtures
  constants/                 # route paths + test data
  fixtures/auth.json         # authenticated storage state (gitignored)
  fixtures/project.json      # run's project name (gitignored)
  global-setup.ts            # local-build index.html patch
  global-teardown.ts         # deletes the project after the suite
  playwright.config.ts       # baseURL + creds from .env.e2e
```

The `tests/auth/login.spec.ts` is the `setup` project. It does the dev-iam
login, then opens the OS app, creates a fresh `E2E Test <timestamp>` project
with the configured test repo, persists the name to `fixtures/project.json`,
and re-saves the authenticated session to `fixtures/auth.json`. The
`chromium` project depends on it, so every spec starts already logged in and
with the new project available; specs read the project name via
`getProjectName()` from `support/project-name.ts`. After the suite,
`globalTeardown` deletes the project through the same `ConsolePage` delete
flow used by `tests_old/`.
