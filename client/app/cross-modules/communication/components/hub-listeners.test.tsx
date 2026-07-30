import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/store/auth.store";

const { conn } = vi.hoisted(() => ({ conn: { on: vi.fn(), off: vi.fn() } }));

vi.mock("../services/notification-hub-client.service", () => ({
  connectNotificationHub: vi.fn().mockResolvedValue(conn),
  disconnectNotificationHub: vi.fn().mockResolvedValue(undefined),
  getNotificationHubConnection: vi.fn(() => conn),
}));
vi.mock("../services/deployment-hub-client.service", () => ({
  connectDeploymentHub: vi.fn().mockResolvedValue(conn),
  disconnectDeploymentHub: vi.fn().mockResolvedValue(undefined),
  getDeploymentHubConnection: vi.fn(() => conn),
}));

import { NotificationHubListener } from "./notification-hub-listener";
import { DeploymentHubListener } from "./deployment-hub-listener";
import {
  connectNotificationHub,
  disconnectNotificationHub,
} from "../services/notification-hub-client.service";
import {
  connectDeploymentHub,
  disconnectDeploymentHub,
} from "../services/deployment-hub-client.service";

describe("hub listeners", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: false, user: null });
  });

  it("NotificationHubListener connects when authenticated", async () => {
    useAuthStore.setState({ isAuthenticated: true });
    render(<NotificationHubListener />);
    await waitFor(() => expect(connectNotificationHub).toHaveBeenCalled());
    await waitFor(() => expect(conn.on).toHaveBeenCalledWith(
      "BuildLogNotification",
      expect.any(Function),
    ));
  });

  it("NotificationHubListener disconnects when not authenticated", async () => {
    render(<NotificationHubListener />);
    await waitFor(() => expect(disconnectNotificationHub).toHaveBeenCalled());
  });

  it("DeploymentHubListener connects for an authenticated user", async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { itemId: "u1" } });
    render(<DeploymentHubListener />);
    await waitFor(() => expect(connectDeploymentHub).toHaveBeenCalledWith("u1"));
  });

  it("DeploymentHubListener disconnects when logged out", async () => {
    render(<DeploymentHubListener />);
    await waitFor(() => expect(disconnectDeploymentHub).toHaveBeenCalled());
  });
});
