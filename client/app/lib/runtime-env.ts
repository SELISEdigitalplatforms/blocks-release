const PLACEHOLDER_PREFIX = "__BLOCKS_";

type RuntimeKey =
  | "BLOCKS_API_BASE_URL"
  | "BLOCKS_X_BLOCKS_KEY"
  | "BLOCKS_GOOGLE_SITE_KEY"
  | "BLOCKS_CONSTRUCT_URL"
  | "BLOCKS_GITHUB_SSO_CLIENT_ID"
  | "BLOCKS_APP_URL"
  | "BLOCKS_LOGIC_APP_URL"
  | "BLOCKS_IDP_BASE_URL"
  | "BLOCKS_OIDC_CLIENT_ID";

declare global {
  interface Window {
    __BLOCKS_ENV__?: Partial<Record<RuntimeKey, string>>;
  }
}

const isPlaceholder = (value?: string) =>
  !!value && value.startsWith(PLACEHOLDER_PREFIX) && value.endsWith("__");

type GetRuntimeEnvOptions = {
  stripPort?: boolean;
};

const stripPortFromUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.port = "";
    return parsedUrl.toString();
  } catch (error) {
    console.error(`Failed to parse URL: ${url}`, error);
    return url;
  }
};
export const getRuntimeEnv = (
  key: RuntimeKey,
  options: GetRuntimeEnvOptions = { stripPort: false },
): string => {
  let value = "";
  const windowValue =
    typeof window !== "undefined" ? window.__BLOCKS_ENV__?.[key] : undefined;
  if (windowValue && !isPlaceholder(windowValue)) {
    value = windowValue;
  } else {
    value = import.meta.env[key] || "";
  }

  if (options.stripPort) {
    value = stripPortFromUrl(value);
  }

  return value;
};
