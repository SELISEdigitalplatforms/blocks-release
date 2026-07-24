import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useGetBlocksNotificationConfig,
  useGetNotifications,
  useMarkAllAsRead,
  useMarkAsRead,
} from "@/cross-modules/communication/hooks/use-notifications";

vi.mock("@/cross-modules/communication/hooks/use-notifications", () => ({
  useGetBlocksNotificationConfig: vi.fn(),
  useGetNotifications: vi.fn(),
  useMarkAsRead: vi.fn(),
  useMarkAllAsRead: vi.fn(),
}));
vi.mock("@blocks-communication/services/notification-hub-client.service", () => ({
  connectNotificationHub: vi.fn().mockResolvedValue(null),
  getNotificationHubConnection: vi.fn(() => null),
}));

import { Notification } from "./notification";

describe("Notification", () => {
  const mutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGetBlocksNotificationConfig).mockReturnValue({
      data: { configurations: [] },
    } as never);
    vi.mocked(useGetNotifications).mockReturnValue({
      data: {
        notifications: [
          {
            id: "n1",
            title: "Build finished",
            description: "Your build is done",
            isRead: false,
            createdTime: "2024-01-01T00:00:00Z",
          },
        ],
        totalNotificationsCount: 1,
        unReadNotificationsCount: 1,
      },
      isLoading: false,
      isFetching: false,
    } as never);
    vi.mocked(useMarkAsRead).mockReturnValue({ mutate } as never);
    vi.mocked(useMarkAllAsRead).mockReturnValue({ mutate } as never);
  });

  it("renders the bell trigger and opens the notification panel", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<Notification />);
    await user.click(screen.getByTestId("notification-bell"));
    await waitFor(() =>
      expect(screen.getByText("Notifications")).toBeInTheDocument(),
    );
  });
});
