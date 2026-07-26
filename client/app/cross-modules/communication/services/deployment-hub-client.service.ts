import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
} from "@microsoft/signalr";
import { getRuntimeEnv } from "@/lib/runtime-env";

const HUB_PATH = "/deploymentHub";

let connection: HubConnection | null = null;
let currentUserId: string | null = null;
let startPromise: Promise<void> | null = null;

// The hub lives on the deployment API server. Resolve its origin from runtime
// env (same source the http-client uses), falling back to the current origin so
// the vite dev proxy can still forward /deploymentHub when the value is unset.
const hubBaseUrl = (): string => {
  const fromEnv = getRuntimeEnv("BLOCKS_API_BASE_URL").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return typeof window !== "undefined" ? window.location.origin : "";
};

const buildConnection = (userId: string): HubConnection => {
  const blocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");
  const url = `${hubBaseUrl()}${HUB_PATH}?x-blocks-key=${encodeURIComponent(
    blocksKey,
  )}&userId=${encodeURIComponent(userId)}`;
  const conn = new HubConnectionBuilder()
    .withUrl(url, { transport: HttpTransportType.WebSockets })
    .withAutomaticReconnect()
    .build();

  conn.onreconnecting((err) => console.error("[DeploymentHub] Reconnecting...", err));
  conn.onreconnected((connId) =>
    console.error("[DeploymentHub] Reconnected. Connection ID:", connId),
  );
  conn.onclose((err) => console.error("[DeploymentHub] Connection closed.", err));

  return conn;
};

export const getDeploymentHubConnection = (): HubConnection | null => connection;

export const connectDeploymentHub = async (
  _userId: string,
): Promise<HubConnection | null> => {
  // Paused: build-log notifications now arrive via the central blocks-logic
  // NotificationHub. To re-enable the local hub, restore the connect logic
  // (build, start, reuse-or-rebuild) using buildConnection().
  console.error(
    "[DeploymentHub] connect skipped - central NotificationHub is the active source.",
  );
  return null;
};

export const disconnectDeploymentHub = async (): Promise<void> => {
  if (!connection) return;
  try {
    if (connection.state !== HubConnectionState.Disconnected) {
      await connection.stop();
    }
  } catch (err) {
    console.error("[DeploymentHub] Error stopping connection:", err);
  } finally {
    connection = null;
    currentUserId = null;
    startPromise = null;
  }
};
