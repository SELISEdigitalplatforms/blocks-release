/**
 * Test double for `@seliseblocks/genesis-os/hooks`.
 */
export type Theme = "light" | "dark" | "system";

export const useScopedPath = () => (sub = "") => `/app/test-project-id/${sub}`;

export const useTheme = () => ({
  theme: "system" as Theme,
  setTheme: () => {},
  resolvedTheme: "light" as const,
});
