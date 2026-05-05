import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
} from "@microsoft/signalr";

const HUB_PATH = "/deploymentHub";

let connection: HubConnection | null = null;
let currentUserId: string | null = null;
let startPromise: Promise<void> | null = null;

const hubBaseUrl = (): string => (typeof window !== "undefined" ? window.location.origin : "");

const buildConnection = (userId: string): HubConnection => {
  const url = `${hubBaseUrl()}${HUB_PATH}?userId=${encodeURIComponent(userId)}`;
  const conn = new HubConnectionBuilder()
    .withUrl(url, { transport: HttpTransportType.WebSockets })
    .withAutomaticReconnect()
    .build();

  conn.onreconnecting((err) => console.warn("[DeploymentHub] Reconnecting...", err));
  conn.onreconnected((connId) =>
    console.log("[DeploymentHub] Reconnected. Connection ID:", connId),
  );
  conn.onclose((err) => console.error("[DeploymentHub] Connection closed.", err));

  return conn;
};

export const getDeploymentHubConnection = (): HubConnection | null => connection;

export const connectDeploymentHub = async (userId: string): Promise<HubConnection | null> => {
  if (!userId) {
    console.warn("[DeploymentHub] connect called without userId; skipping.");
    return null;
  }

  // Already connected (or connecting) for this user — reuse it.
  if (connection && currentUserId === userId) {
    if (
      connection.state === HubConnectionState.Connected ||
      connection.state === HubConnectionState.Connecting ||
      connection.state === HubConnectionState.Reconnecting
    ) {
      if (startPromise) await startPromise;
      return connection;
    }
  }

  // Different user (or stale connection) — tear down and rebuild.
  if (connection) {
    await disconnectDeploymentHub();
  }

  currentUserId = userId;
  connection = buildConnection(userId);

  console.log(`[DeploymentHub] Connecting to ${HUB_PATH} as user ${userId}...`);
  startPromise = connection
    .start()
    .then(() => {
      console.log("[DeploymentHub] Connected. State:", connection?.state);
    })
    .catch((err) => {
      console.error("[DeploymentHub] Connection failed:", err);
      throw err;
    })
    .finally(() => {
      startPromise = null;
    });

  try {
    await startPromise;
  } catch {
    // already logged
  }
  return connection;
};

export const disconnectDeploymentHub = async (): Promise<void> => {
  if (!connection) return;
  try {
    if (connection.state !== HubConnectionState.Disconnected) {
      await connection.stop();
    }
  } catch (err) {
    console.warn("[DeploymentHub] Error stopping connection:", err);
  } finally {
    connection = null;
    currentUserId = null;
    startPromise = null;
  }
};
