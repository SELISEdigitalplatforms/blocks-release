import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import {
  connectDeploymentHub,
  disconnectDeploymentHub,
  getDeploymentHubConnection,
} from "../services/deployment-hub-client.service";

const EVENT_NAME = "BuildLogNotification";

export const DeploymentHubListener = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.itemId ?? null);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    let cancelled = false;
    const handler = (message: unknown) => {
      console.log(`[DeploymentHub] Received ${EVENT_NAME}:`, message);
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: {
            method: EVENT_NAME,
            message,
            timestamp: new Date().toISOString(),
          },
        }),
      );
    };

    (async () => {
      const conn = await connectDeploymentHub(userId);
      if (cancelled || !conn) return;
      conn.on(EVENT_NAME, handler);
    })();

    return () => {
      cancelled = true;
      const conn = getDeploymentHubConnection();
      conn?.off(EVENT_NAME, handler);
    };
  }, [isAuthenticated, userId]);

  // Tear the socket down on logout so the next user gets a fresh, correctly-scoped connection.
  useEffect(() => {
    if (isAuthenticated) return;
    void disconnectDeploymentHub();
  }, [isAuthenticated]);

  return null;
};
