import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { notificationService } from "../services/notification.service";
import {
  useGetBlocksNotificationConfig,
  useGetNotifications,
  useMarkAllAsRead,
  useMarkAsRead,
} from "./use-notifications";

vi.mock("../services/notification.service", () => ({
  notificationService: {
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
    getNotificationConfigs: vi.fn(),
  },
}));

describe("notification hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useGetNotifications fetches the list", async () => {
    vi.mocked(notificationService.getNotifications).mockResolvedValue({
      unReadNotificationsCount: 0,
      totalNotificationsCount: 0,
      notifications: [],
    });
    const { result } = renderHook(() => useGetNotifications(1, 10), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notificationService.getNotifications).toHaveBeenCalledWith(1, 10);
  });

  it("useMarkAsRead calls the service", async () => {
    vi.mocked(notificationService.markAsRead).mockResolvedValue({
      errors: null,
      isSuccess: true,
    });
    const { result } = renderHook(() => useMarkAsRead(), {
      wrapper: createWrapper(),
    });
    result.current.mutate("n1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(notificationService.markAsRead).mock.calls[0][0]).toBe(
      "n1",
    );
  });

  it("useMarkAllAsRead calls the service and invalidates", async () => {
    vi.mocked(notificationService.markAllNotificationsAsRead).mockResolvedValue({
      errors: null,
      isSuccess: true,
    });
    const { result } = renderHook(() => useMarkAllAsRead(), {
      wrapper: createWrapper(),
    });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notificationService.markAllNotificationsAsRead).toHaveBeenCalled();
  });

  it("useGetBlocksNotificationConfig fetches configs", async () => {
    vi.mocked(notificationService.getNotificationConfigs).mockResolvedValue({
      configurations: [],
      totalCount: 0,
      errors: null,
      isSuccess: true,
    });
    const { result } = renderHook(() => useGetBlocksNotificationConfig(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notificationService.getNotificationConfigs).toHaveBeenCalled();
  });
});
