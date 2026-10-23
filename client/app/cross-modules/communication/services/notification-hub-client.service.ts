import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
} from "@microsoft/signalr";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { notificationService } from "./notification.service";

const HUB_PATH = "/api/NotificationHub";

// Wait before retry n (0-based); after the list is used up, retry every minute.
const RETRY_DELAYS_MS = [2000, 5000, 15_000, 30_000];
const STEADY_RETRY_MS = 60_000;

let connection: HubConnection | null = null;
let startPromise: Promise<void> | null = null;

// Reconnect state. `wanted` is true from connectNotificationHub() until disconnectNotificationHub().
let wanted = false;
let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let recovering: Promise<void> | null = null;

// A refresh that was refused ends as HttpError(401): the user is logged out.
const isLoggedOut = (error: unknown): boolean =>
  (error as { status?: number } | null)?.status === 401;

// Any other HTTP status (403, 404, 5xx) means the http client got a response and refreshed the
// login if it needed to: go on and start. Only an error with no status (network) is retried.
const hasHttpStatus = (error: unknown): boolean =>
  typeof (error as { status?: unknown } | null)?.status === "number";

const refreshLogin = async (probe: Promise<unknown>): Promise<void> => {
  try {
    await probe;
  } catch (error) {
    if (isLoggedOut(error) || !hasHttpStatus(error)) throw error;
  }
};

const stopRetrying = () => {
  clearTimeout(retryTimer);
  retryTimer = undefined;
  globalThis.removeEventListener("online", onWake);
  document.removeEventListener("visibilitychange", onVisibility);
};

const scheduleRetry = () => {
  const delay = RETRY_DELAYS_MS[attempt] ?? STEADY_RETRY_MS;
  attempt += 1;
  retryTimer = setTimeout(() => recover(), delay);
};

const tryRestart = async (): Promise<void> => {
  clearTimeout(retryTimer);
  retryTimer = undefined;
  const conn = connection;
  if (!wanted || !conn || startPromise || conn.state !== HubConnectionState.Disconnected) return;
  // Offline: the "online" event tries again (a failed refresh would log the user out).
  if (navigator.onLine === false) return;

  try {
    // Cheap authenticated GET: the http client refreshes the login on 401.
    await refreshLogin(notificationService.getNotifications(1, 1));
    if (!wanted || conn !== connection) return;
    await conn.start();
    attempt = 0;
    if (!wanted || conn !== connection) await conn.stop();
  } catch (err) {
    if (!wanted || conn !== connection) return;
    if (isLoggedOut(err)) {
      wanted = false;
      stopRetrying();
      return;
    }
    console.error("[NotificationHub] Reconnect failed:", err);
    scheduleRetry();
  }
};

// Never two starts at once: callers share the run that is already going.
const recover = (): Promise<void> => {
  recovering ??= tryRestart().finally(() => {
    recovering = null;
  });
  return recovering;
};

function onWake() {
  if (wanted) recover();
}

function onVisibility() {
  if (document.visibilityState === "visible") onWake();
}

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
    console.error("[NotificationHub] Reconnecting...", err),
  );
  conn.onreconnected((connId) =>
    console.error("[NotificationHub] Reconnected. Connection ID:", connId),
  );
  conn.onclose((err) => {
    console.error("[NotificationHub] Connection closed.", err);
    // The server closes the hub when the login expires: log in again, then start again.
    if (wanted && conn === connection) recover();
  });

  return conn;
};

export const getNotificationHubConnection = (): HubConnection | null => connection;

export const connectNotificationHub = async (): Promise<HubConnection | null> => {
  if (!hubBaseUrl()) {
    console.error("[NotificationHub] BLOCKS_LOGIC_BASE_URL is not configured; skipping connection.");
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
  if (!wanted) {
    globalThis.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onVisibility);
  }
  wanted = true;
  attempt = 0;
  clearTimeout(retryTimer);

  console.error(`[NotificationHub] Connecting to ${HUB_PATH}...`);
  startPromise = connection
    .start()
    .then(() => {
      console.error("[NotificationHub] Connected. State:", connection?.state);
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
    // already logged; try again with backoff
    if (wanted) scheduleRetry();
  }
  return connection;
};

export const disconnectNotificationHub = async (): Promise<void> => {
  wanted = false;
  stopRetrying();
  if (!connection) return;
  try {
    if (connection.state !== HubConnectionState.Disconnected) {
      await connection.stop();
    }
  } catch (err) {
    console.error("[NotificationHub] Error stopping connection:", err);
  } finally {
    connection = null;
    startPromise = null;
  }
};
