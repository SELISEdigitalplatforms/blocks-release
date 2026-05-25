import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import {
  connectNotificationHub,
  disconnectNotificationHub,
  getNotificationHubConnection,
} from "../services/notification-hub-client.service";

const EVENT_NAME = "BuildLogNotification";

const safeParse = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const NotificationHubListener = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const handler = (message: unknown) => {
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: {
            method: EVENT_NAME,
            message: safeParse(message),
            timestamp: new Date().toISOString(),
          },
        }),
      );
    };

    (async () => {
      const conn = await connectNotificationHub();
      if (cancelled || !conn) return;
      conn.on(EVENT_NAME, handler);
    })();

    return () => {
      cancelled = true;
      const conn = getNotificationHubConnection();
      conn?.off(EVENT_NAME, handler);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) return;
    void disconnectNotificationHub();
  }, [isAuthenticated]);

  return null;
};
