/// <reference types="vitest/config" />
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Test doubles for @seliseblocks/blocks-kit. The real package crashes on
      // import under jsdom (framer-motion + a signalr NotificationListener that
      // read env/process at module-eval time), so the design-system is aliased
      // to lightweight stubs for unit tests. Subpaths must precede the barrel so
      // the more specific match wins.
      "@seliseblocks/blocks-kit/hooks": path.resolve(
        __dirname,
        "./app/test-utils/stubs/blocks-kit-hooks.tsx",
      ),
      "@seliseblocks/blocks-kit/providers": path.resolve(
        __dirname,
        "./app/test-utils/stubs/blocks-kit-providers.tsx",
      ),
      "@seliseblocks/blocks-kit/store": path.resolve(
        __dirname,
        "./app/test-utils/stubs/blocks-kit-store.ts",
      ),
      "@seliseblocks/blocks-kit": path.resolve(
        __dirname,
        "./app/test-utils/stubs/blocks-kit.tsx",
      ),
      "@": path.resolve(__dirname, "./app"),
      "@blocks-idp": path.resolve(__dirname, "./app/cross-modules/idp"),
      "@blocks-lmt": path.resolve(__dirname, "./app/cross-modules/lmt"),
      "@blocks-storage": path.resolve(__dirname, "./app/cross-modules/storage"),
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
  test: {
    environment: "jsdom",
    globals: true,
    // Reset spy call history before every test so shared mocks (e.g. the http
    // client / service factories) don't leak calls across test cases.
    clearMocks: true,
    setupFiles: ["./app/test-utils/vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "json-summary"],
      // Minimum FE unit-test coverage gate. `test:coverage` fails if any of
      // these drop below 10%.
      thresholds: {
        statements: 10,
        lines: 10,
        functions: 10,
      },
      include: ["app/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.test.*",
        "app/**/*.spec.*",
        "app/**/*.d.ts",
        "app/**/main.tsx",
        "app/**/vite-env.d.ts",
        "**/components/ui/**",
        "app/**/*.stories.*",
        "**/__generated__/**",
        "**/*.gen.*",
        "app/**/test-utils/**",
        "app/**/__mocks__/**",
      ],
    },
  },
});
