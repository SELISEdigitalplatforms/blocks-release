import fs from "fs";
import path from "path";

/**
 * Point a locally-served Blocks Release at itself, not the remote dev host.
 *
 * The built index.html carries runtime config in `window.__BLOCKS_ENV__`. The
 * .NET host bakes `BLOCKS_RELEASE_BASE_URL` from the `FrontendRuntime` config
 * section (see server/Api/Program.cs), which is the deployed host WITHOUT a
 * port. When Release runs locally on API_PORT, the SPA would then send its API
 * calls to the remote dev server, so the console shows no local data. This
 * patches the served index.html so BLOCKS_RELEASE_BASE_URL === E2E_BASE_URL.
 *
 * Idempotent and order-independent: it rewrites the concrete value (or the
 * `__BLOCKS_RELEASE_BASE_URL__` placeholder), so it holds whether it runs
 * before or after the host's own startup replacement.
 *
 * Against the remote dev host (Mode A, E2E_NO_WEBSERVER=1) there is no local
 * wwwroot to patch, so this logs a skip warning and does nothing — expected.
 */
export default function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL;
  if (!baseURL) return; // playwright.config.ts already throws when unset

  const indexHtml = path.resolve(__dirname, "../server/Api/wwwroot/index.html");
  if (!fs.existsSync(indexHtml)) {
    console.warn(
      `[e2e] index.html not found at ${indexHtml} — skipping BLOCKS_RELEASE_BASE_URL patch. ` +
        `Expected when testing a remote host; build the FE first (run.sh -a) for a local run.`,
    );
    return;
  }

  const original = fs.readFileSync(indexHtml, "utf8");
  const patched = original.replace(/(BLOCKS_RELEASE_BASE_URL:\s*")([^"]*)(")/g, `$1${baseURL}$3`);

  if (patched === original) {
    console.log(`[e2e] BLOCKS_RELEASE_BASE_URL already "${baseURL}" — no patch needed.`);
    return;
  }

  fs.writeFileSync(indexHtml, patched);
  console.log(`[e2e] Patched BLOCKS_RELEASE_BASE_URL -> "${baseURL}" in served index.html.`);
}
