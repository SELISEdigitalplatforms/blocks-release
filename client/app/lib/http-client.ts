import { HttpClient } from "@seliseblocks/genesis-os";
import { createHttpFailureReporter, getRollbar } from "@seliseblocks/genesis-os/observability";
import { getMergedAreaBaseUrl } from "@seliseblocks/genesis-os/lib";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { SERVICE_NAME } from "@/constants/service.constant";

// Memoised, so every client below and the provider in main.tsx share one Rollbar instance.
// Only failures that never reached the server -- API unreachable, DNS, CORS, TLS -- are reported;
// anything carrying an HTTP status is either a business outcome or already reported server-side.
const reportTransportFailure = createHttpFailureReporter(getRollbar({ service: SERVICE_NAME }));

export const serviceInstances = {
  deploymentService: new HttpClient({
    baseURL: () => getRuntimeEnv("BLOCKS_API_BASE_URL") || "",
    blocksKey: () => getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "",
    onError: reportTransportFailure,
  }),
  // Logic is served by the os host: BLOCKS_LOGIC_BASE_URL while set, else BLOCKS_OS_BASE_URL.
  logicService: new HttpClient({
    baseURL: () => getMergedAreaBaseUrl("BLOCKS_LOGIC_BASE_URL"),
    blocksKey: () => getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "",
    onError: reportTransportFailure,
  }),
  idpService: new HttpClient({
    baseURL: () => getRuntimeEnv("BLOCKS_IDP_BASE_URL") || "",
    blocksKey: () => getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "",
    onError: reportTransportFailure,
  }),
};

export { HttpClient };
