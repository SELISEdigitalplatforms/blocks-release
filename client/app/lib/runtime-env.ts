const PLACEHOLDER_PREFIX = "__BLOCKS_";

type RuntimeKey =
  | "BLOCKS_API_BASE_URL"
  | "BLOCKS_X_BLOCKS_KEY"
  | "BLOCKS_GOOGLE_SITE_KEY"
  | "BLOCKS_CONSTRUCT_URL"
  | "BLOCKS_GITHUB_SSO_CLIENT_ID"
  | "BLOCKS_APP_URL"
  | "BLOCKS_LOGIC_BASE_URL"
  | "BLOCKS_IDP_BASE_URL"
  | "BLOCKS_OS_URL"
  | "BLOCKS_OIDC_CLIENT_ID"
  | "BLOCKS_BASE_DOMAIN"
  | "BLOCKS_IAM_BASE_URL"
  | "BLOCKS_IAM_CALLBACK_URL"
  | "BLOCKS_LOCALIZATION_BASE_URL"
  | "BLOCKS_LOCALIZATION_CALLBACK_URL"
  | "BLOCKS_AGENTS_BASE_URL"
  | "BLOCKS_AGENTS_CALLBACK_URL"
  | "BLOCKS_DATA_BASE_URL"
  | "BLOCKS_DATA_CALLBACK_URL"
  | "BLOCKS_OS_BASE_URL"
  | "BLOCKS_OS_CALLBACK_URL"
  | "BLOCKS_UTILITIES_BASE_URL"
  | "BLOCKS_UTILITIES_CALLBACK_URL"
  | "BLOCKS_LOGIC_BASE_URL"
  | "BLOCKS_LOGIC_CALLBACK_URL"
  | "BLOCKS_MONITOR_BASE_URL"
  | "BLOCKS_MONITOR_CALLBACK_URL"
  | "BLOCKS_RELEASE_BASE_URL"
  | "BLOCKS_RELEASE_CALLBACK_URL"
  | "BLOCKS_STUDIO_BASE_URL"
  | "BLOCKS_STUDIO_CALLBACK_URL";

// NOTE: the `Window.__BLOCKS_ENV__` global is declared by @seliseblocks/blocks-kit.
// We intentionally do not re-declare it here to avoid a conflicting augmentation
// (blocks-kit types it against its own RuntimeKey union); we read it via a
// string-keyed cast below so deployment's own keys continue to work.

const isPlaceholder = (value?: string) =>
  !!value && value.startsWith(PLACEHOLDER_PREFIX) && value.endsWith("__");

type GetRuntimeEnvOptions = {
  stripPort?: boolean;
  ensureTrailingSlash?: boolean;
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

const ensureTrailingSlash = (url: string) =>
  url.endsWith("/") ? url : `${url}/`;

const isLocalEnv = () => {
  if (import.meta.env.DEV) return true;

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    return hostname === "localhost" || hostname === "127.0.0.1";
  }

  return false;
};

export const getRuntimeEnv = (
  key: RuntimeKey,
  options: GetRuntimeEnvOptions = {},
): string => {
  let value = "";
  const runtimeEnv =
    typeof window !== "undefined"
      ? (window.__BLOCKS_ENV__ as Partial<Record<string, string>> | undefined)
      : undefined;
  const windowValue = runtimeEnv?.[key];
  if (windowValue && !isPlaceholder(windowValue)) {
    value = windowValue;
  } else {
    value = import.meta.env[key] || "";
  }

  if (options.stripPort && !isLocalEnv()) {
    value = stripPortFromUrl(value);
  }

  if (value && options.ensureTrailingSlash) {
    value = ensureTrailingSlash(value);
  }

  return value;
};
