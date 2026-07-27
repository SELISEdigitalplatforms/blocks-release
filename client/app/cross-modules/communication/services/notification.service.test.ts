import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import {
  NOTIFICATION_CONFIG_ENDPOINTS,
  NOTIFICATION_ENDPOINTS,
} from "../constants/endpoint.constant";
import { notificationService } from "./notification.service";
import type { INotificationConfig } from "../models/notification.model";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("NotificationService", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    vi.mocked(http.post).mockResolvedValue({} as never);
  });

  it("getNotifications requests the right page (zero based)", async () => {
    await notificationService.getNotifications(2, 20);
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain(NOTIFICATION_ENDPOINTS.GET_NOTIFICATIONS);
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=20");
  });

  it("markAsRead posts the notification id", async () => {
    await notificationService.markAsRead("n1");
    expect(http.post).toHaveBeenCalledWith(NOTIFICATION_ENDPOINTS.MARK_AS_READ, {
      id: "n1",
    });
  });

  it("markAllNotificationsAsRead posts to the mark-all endpoint", async () => {
    await notificationService.markAllNotificationsAsRead();
    expect(http.post).toHaveBeenCalledWith(
      NOTIFICATION_ENDPOINTS.MARK_ALL_AS_READ,
      {},
    );
  });

  it("getNotificationConfigs builds a paged url", async () => {
    await notificationService.getNotificationConfigs(1, 5, "pk");
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain(NOTIFICATION_CONFIG_ENDPOINTS.GET_CONFIGS);
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=5");
    expect(url).toContain("projectKey=pk");
  });

  it("getNotificationConfig dispatches a parsed custom event", () => {
    const listener = vi.fn();
    const config = { notifyMethod: "MyMethod" } as INotificationConfig;
    window.addEventListener("MyMethod", listener as EventListener);
    notificationService.getNotificationConfig(config, JSON.stringify({ a: 1 }));
    window.removeEventListener("MyMethod", listener as EventListener);
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.message).toEqual({ a: 1 });
    expect(event.detail.method).toBe("MyMethod");
  });

  it("getNotificationConfig keeps a non-json message as a string", () => {
    const listener = vi.fn();
    const config = { notifyMethod: "Plain" } as INotificationConfig;
    window.addEventListener("Plain", listener as EventListener);
    notificationService.getNotificationConfig(config, "not json");
    window.removeEventListener("Plain", listener as EventListener);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.message).toBe("not json");
  });
});
