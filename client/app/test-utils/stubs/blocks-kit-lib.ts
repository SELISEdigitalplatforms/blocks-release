// Test double for @seliseblocks/genesis-os/lib: only what the app imports, with the package's own rule for the
// areas merged into the os app (logic, localization, data, monitor). Reads window.__BLOCKS_ENV__ like the package.
export const MERGED_AREA_KEYS = [
  "BLOCKS_LOGIC_BASE_URL",
  "BLOCKS_LOCALIZATION_BASE_URL",
  "BLOCKS_DATA_BASE_URL",
  "BLOCKS_MONITOR_BASE_URL",
] as const;

export type MergedAreaKey = (typeof MERGED_AREA_KEYS)[number];

const PLACEHOLDER = /^__BLOCKS_.*__$/;

const env = (key: string): string => {
  const value = (globalThis.window as { __BLOCKS_ENV__?: Record<string, string> } | undefined)
    ?.__BLOCKS_ENV__?.[key];
  return value && !PLACEHOLDER.test(value) ? value : "";
};

export const isMergedAreaKey = (key: string): key is MergedAreaKey =>
  (MERGED_AREA_KEYS as readonly string[]).includes(key);

export const getMergedAreaBaseUrl = (key: MergedAreaKey): string =>
  env(key) || env("BLOCKS_OS_BASE_URL");
