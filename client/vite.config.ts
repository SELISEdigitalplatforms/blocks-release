import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { defineConfig, loadEnv } from "vite";

function getHttpsConfig(env: Record<string, string>): false | { key: Buffer; cert: Buffer } {
  if ((env.BLOCKS_DEV_HTTPS ?? "").toLowerCase() !== "true") {
    return false;
  }

  const keyPath =
    env.BLOCKS_DEV_SSL_KEY_PATH ||
    "C:/SSL_Certificates/dev-deployment.blocksdevelopers.com-key.pem";
  const certPath =
    env.BLOCKS_DEV_SSL_CERT_PATH ||
    "C:/SSL_Certificates/dev-deployment.blocksdevelopers.com.pem";

  const resolvedKeyPath = path.resolve(__dirname, keyPath);
  const resolvedCertPath = path.resolve(__dirname, certPath);

  if (!fs.existsSync(resolvedKeyPath) || !fs.existsSync(resolvedCertPath)) {
    throw new Error(
      `HTTPS certificate files were not found. Checked key: ${resolvedKeyPath}, cert: ${resolvedCertPath}`,
    );
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
  const httpsConfig = getHttpsConfig(env);

  return {
    envPrefix: ["BLOCKS_"],
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./app"),
        "@blocks-idp": path.resolve(__dirname, "./app/cross-modules/idp"),
        "@blocks-lmt": path.resolve(__dirname, "./app/cross-modules/lmt"),
        "@blocks-storage": path.resolve(
          __dirname,
          "./app/cross-modules/storage",
        ),
        "@blocks-communication": path.resolve(
          __dirname,
          "./app/cross-modules/communication",
        ),
        "@blocks-identifier": path.resolve(
          __dirname,
          "./app/cross-modules/identifier",
        ),
        "@blocks-localization": path.resolve(
          __dirname,
          "./app/cross-modules/localization",
        ),
        "@blocks-utilities": path.resolve(
          __dirname,
          "./app/cross-modules/utilities",
        ),
        "@blocks-ai": path.resolve(__dirname, "./app/cross-modules/ai"),
        "@blocks-deployment": path.resolve(
          __dirname,
          "./app/cross-modules/deployment",
        ),
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
        "dev-deployment.blocksdevelopers.com",
        "localhost",
        ".seliseblocks.com",
        ".blocksdevelopers.com",
      ],
      proxy: {
        ...(idpProxyTarget
          ? {
              "/dev-idp-proxy": {
                target: idpProxyTarget,
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/dev-idp-proxy/, ""),
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
              "/deploymentHub": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
                ws: true,
              },
            }
          : {}),
      },
    },
  };
});
