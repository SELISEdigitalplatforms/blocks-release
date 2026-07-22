import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
} from "@microsoft/signalr";
import { getRuntimeEnv } from "@/lib/runtime-env";

const HUB_PATH = "/api/NotificationHub";

let connection: HubConnection | null = null;
let startPromise: Promise<void> | null = null;

const hubBaseUrl = (): string =>
  getRuntimeEnv("BLOCKS_LOGIC_BASE_URL").trim().replace(/\/$/, "");

const buildConnection = (): HubConnection => {
  const blocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");
  const url = `${hubBaseUrl()}${HUB_PATH}?x-blocks-key=${encodeURIComponent(blocksKey)}`;
  const conn = new HubConnectionBuilder()
    .withUrl(url, { transport: HttpTransportType.WebSockets })
    .withAutomaticReconnect()
    .build();

  conn.onreconnecting((err) =>
    console.warn("[NotificationHub] Reconnecting...", err),
  );
  conn.onreconnected((connId) =>
    console.log("[NotificationHub] Reconnected. Connection ID:", connId),
  );
  conn.onclose((err) => console.error("[NotificationHub] Connection closed.", err));

  return conn;
};

export const getNotificationHubConnection = (): HubConnection | null => connection;

export const connectNotificationHub = async (): Promise<HubConnection | null> => {
  if (!hubBaseUrl()) {
    console.warn("[NotificationHub] BLOCKS_LOGIC_BASE_URL is not configured; skipping connection.");
    return null;
  }

  if (connection) {
    if (
      connection.state === HubConnectionState.Connected ||
      connection.state === HubConnectionState.Connecting ||
      connection.state === HubConnectionState.Reconnecting
    ) {
      if (startPromise) await startPromise;
      return connection;
    }
  }

  connection = buildConnection();

  console.log(`[NotificationHub] Connecting to ${HUB_PATH}...`);
  startPromise = connection
    .start()
    .then(() => {
      console.log("[NotificationHub] Connected. State:", connection?.state);
    })
    .catch((err) => {
      console.error("[NotificationHub] Connection failed:", err);
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

export const disconnectNotificationHub = async (): Promise<void> => {
  if (!connection) return;
  try {
    if (connection.state !== HubConnectionState.Disconnected) {
      await connection.stop();
    }
  } catch (err) {
    console.warn("[NotificationHub] Error stopping connection:", err);
  } finally {
    connection = null;
    startPromise = null;
  }
};
