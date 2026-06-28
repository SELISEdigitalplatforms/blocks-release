import { HttpClient } from "@seliseblocks/blocks-kit";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const serviceInstances = {
  deploymentService: new HttpClient({
    baseURL: () => getRuntimeEnv("BLOCKS_API_BASE_URL") || "",
    blocksKey: () => getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "",
  }),
  logicService: new HttpClient({
    baseURL: () => getRuntimeEnv("BLOCKS_LOGIC_BASE_URL") || "",
    blocksKey: () => getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "",
  }),
  idpService: new HttpClient({
    baseURL: () => getRuntimeEnv("BLOCKS_IDP_BASE_URL") || "",
    blocksKey: () => getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "",
  }),
};

export { HttpClient };
