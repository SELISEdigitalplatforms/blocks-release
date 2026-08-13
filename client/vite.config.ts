import react from "@vitejs/plugin-react";
import fs from "fs";
// import { get } from "http";
import path from "path";
import { defineConfig, loadEnv } from "vite";

// HTTPS is driven solely by the machine env vars RELEASE_SSL_CERT / RELEASE_SSL_KEY.
// If either is unset/empty, or the file it points to is missing, fall back to HTTP (no throw).
function getHttpsConfig(): false | { key: Buffer; cert: Buffer } {
  const certPath = process.env.RELEASE_SSL_CERT;
  const keyPath = process.env.RELEASE_SSL_KEY;

  if (!certPath || !keyPath) {
    console.error("[vite] RELEASE_SSL_CERT / RELEASE_SSL_KEY not set - serving over HTTP.");
    return false;
  }

  const resolvedCertPath = path.resolve(__dirname, certPath);
  const resolvedKeyPath = path.resolve(__dirname, keyPath);

  if (!fs.existsSync(resolvedCertPath) || !fs.existsSync(resolvedKeyPath)) {
    console.error(
      `[vite] SSL cert files not found (cert: ${resolvedCertPath}, key: ${resolvedKeyPath}) - serving over HTTP.`,
    );
    return false;
  }

  return {
    key: fs.readFileSync(resolvedKeyPath),
    cert: fs.readFileSync(resolvedCertPath),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "BLOCKS_");
  const proxyTarget = env.BLOCKS_API_BASE_URL;
  const idpProxyTarget = env.BLOCKS_IDP_BASE_URL;
  const devHost = env.BLOCKS_DEV_HOST || true;
  const httpsConfig = getHttpsConfig();
  getHttpsConfig();
  return {
    envPrefix: ["BLOCKS_"],
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./app"),
        "@blocks-idp": path.resolve(__dirname, "./app/cross-modules/idp"),
        "@blocks-lmt": path.resolve(__dirname, "./app/cross-modules/lmt"),
        "@blocks-storage": path.resolve(__dirname, "./app/cross-modules/storage"),
        "@blocks-communication": path.resolve(__dirname, "./app/cross-modules/communication"),
        "@blocks-identifier": path.resolve(__dirname, "./app/cross-modules/identifier"),
        "@blocks-localization": path.resolve(__dirname, "./app/cross-modules/localization"),
        "@blocks-utilities": path.resolve(__dirname, "./app/cross-modules/utilities"),
        "@blocks-ai": path.resolve(__dirname, "./app/cross-modules/ai"),
        "@blocks-deployment": path.resolve(__dirname, "./app/cross-modules/deployment"),
      },
    },
    build: {
      outDir: "../server/Api/wwwroot",
      emptyOutDir: true,
    },
    server: {
      host: devHost, // Listen on all addresses or configured host
      port: 4000,
      strictPort: true,
      https: httpsConfig || undefined,
      allowedHosts: [
        "dev-cloud.seliseblocks.com",
        "dev-release.blocksdevelopers.com",
        "localhost",
        ".seliseblocks.com",
        ".blocksdevelopers.com",
      ],
      proxy: {
        ...(idpProxyTarget
          ? {
              "/dev-iam-proxy": {
                target: idpProxyTarget,
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/dev-iam-proxy/, ""),
              },
            }
          : {}),
        ...(proxyTarget
          ? {
              "/api": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/cloudbuild": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/idp": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/identifier": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/communication": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/cloudconfiguration": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/uilm": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/utilities": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/lmt": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/mfa": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/alert": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/blocksai-api": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/studio": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              "/uds": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
              },
              // DeploymentHub WebSocket proxy paused while build-log notifications
              // are received via the central blocks-logic NotificationHub. Restore
              // by uncommenting this block.
              // "/deploymentHub": {
              //   target: proxyTarget,
              //   changeOrigin: true,
              //   secure: false,
              //   ws: true,
              // },
            }
          : {}),
      },
    },
  };
});
