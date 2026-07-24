import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useGetBlocksNotificationConfig,
  useGetNotifications,
  useMarkAllAsRead,
  useMarkAsRead,
} from "@/cross-modules/communication/hooks/use-notifications";
import {
  connectNotificationHub,
  getNotificationHubConnection,
} from "@blocks-communication/services/notification-hub-client.service";

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
vi.mock("@blocks-communication/services/notification.service", () => ({
  notificationService: { getNotificationConfig: vi.fn() },
}));

import { Notification } from "./notification";

const denormalized = (over = {}) =>
  JSON.stringify({
    title: "agent_kb_processing_status",
    description: "desc",
    redirectPath: "",
    toastable: false,
    meta: JSON.stringify({ status: "done", kb_id: "abc-123" }),
    ...over,
  });

describe("Notification", () => {
  const markAsReadMutate = vi.fn((_id, opts) => opts?.onSuccess?.());
  const markAllMutate = vi.fn((_v, opts) => opts?.onSuccess?.());

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
            denormalizedPayload: denormalized(),
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
    vi.mocked(useMarkAsRead).mockReturnValue({ mutate: markAsReadMutate } as never);
    vi.mocked(useMarkAllAsRead).mockReturnValue({ mutate: markAllMutate } as never);
  });

  it("renders the bell trigger and opens the notification panel", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<Notification />);
    await user.click(screen.getByTestId("notification-bell"));
    await waitFor(() =>
      expect(screen.getByText("Notifications")).toBeInTheDocument(),
    );
    // The KB title is formatted into a readable label.
    expect(
      screen.getByText("AI Agent Knowledge Update Status"),
    ).toBeInTheDocument();
    // The meta status/kb id is formatted into the description.
    expect(screen.getByText(/Status: Done \| KB Id: abc/)).toBeInTheDocument();
  });

  it("marks a notification as read on hover and marks all as read on click", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<Notification />);
    await user.click(screen.getByTestId("notification-bell"));
    const item = await screen.findByText("AI Agent Knowledge Update Status");
    fireEvent.mouseEnter(item.closest("div.cursor-pointer") as HTMLElement);
    expect(markAsReadMutate).toHaveBeenCalledWith("n1", expect.anything());
    fireEvent.click(screen.getByText("Mark all as read"));
    expect(markAllMutate).toHaveBeenCalled();
  });

  it("caps the unread badge at 99+", () => {
    vi.mocked(useGetNotifications).mockReturnValue({
      data: {
        notifications: [],
        totalNotificationsCount: 0,
        unReadNotificationsCount: 150,
      },
      isLoading: false,
      isFetching: false,
    } as never);
    renderWithProviders(<Notification />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("subscribes to hub notifications and invalidates on incoming payload", async () => {
    const conn = { on: vi.fn(), off: vi.fn() };
    vi.mocked(connectNotificationHub).mockResolvedValue(conn as never);
    vi.mocked(getNotificationHubConnection).mockReturnValue(conn as never);
    vi.mocked(useGetBlocksNotificationConfig).mockReturnValue({
      data: { configurations: [{ notifyMethod: "OnBuild" }] },
    } as never);
    const { unmount } = renderWithProviders(<Notification />);
    await waitFor(() =>
      expect(conn.on).toHaveBeenCalledWith("OnBuild", expect.any(Function)),
    );
    // Drive the registered handler with a valid payload.
    const handler = conn.on.mock.calls[0][1] as (m: string) => void;
    handler(
      JSON.stringify({
        denormalizedPayload: JSON.stringify({ title: "t", description: "d" }),
      }),
    );
    unmount();
    expect(conn.off).toHaveBeenCalledWith("OnBuild", expect.any(Function));
  });
});
