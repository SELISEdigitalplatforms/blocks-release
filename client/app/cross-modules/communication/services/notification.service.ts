import { serviceInstances } from "@/lib/http-client";
import { INotification, INotificationConfig } from "../models/notification.model";
import {
  NOTIFICATION_ENDPOINTS,
  NOTIFICATION_CONFIG_ENDPOINTS,
} from "../constants/endpoint.constant";

// Notifications live on the logic server; logicService is already based there.
const logic = serviceInstances.logicService;

export class NotificationService {
  getNotifications = (
    pageNumber: number,
    pageSize: number,
  ): Promise<{
    unReadNotificationsCount: number;
    totalNotificationsCount: number;
    notifications: INotification[];
  }> => {
    const params = new URLSearchParams({
      page: String(pageNumber - 1),
      pageSize: String(pageSize),
    });
    return logic.get(`${NOTIFICATION_ENDPOINTS.GET_NOTIFICATIONS}?${params}`);
  };

  markAsRead = (notificationId: string): Promise<{ errors: null | unknown; isSuccess: boolean }> => {
    return logic.post(NOTIFICATION_ENDPOINTS.MARK_AS_READ, { id: notificationId });
  };

  markAllNotificationsAsRead = (): Promise<{ errors: null | unknown; isSuccess: boolean }> => {
    return logic.post(NOTIFICATION_ENDPOINTS.MARK_ALL_AS_READ, {});
  };

  getNotificationConfig = (config: INotificationConfig, message: string): void => {
    let parsedMessage: unknown = message;
    if (typeof message === "string") {
      try {
        parsedMessage = JSON.parse(message);
      } catch {
        parsedMessage = message;
      }
    }
    const notificationEvent = new CustomEvent(config.notifyMethod, {
      detail: {
        method: config.notifyMethod,
        message: parsedMessage,
        timestamp: new Date().toISOString(),
        config: config,
      },
    });
    window.dispatchEvent(notificationEvent);
  };

  getNotificationConfigs = (
    page: number = 0,
    pageSize: number = 10,
    projectKey: string,
  ): Promise<{
    configurations: INotificationConfig[];
    totalCount: number;
    errors: null | unknown;
    isSuccess: boolean;
  }> => {
    return logic.get(
      `${NOTIFICATION_CONFIG_ENDPOINTS.GET_CONFIGS}?page=${page}&pageSize=${pageSize}&projectKey=${projectKey}`,
    );
  };
}

export const notificationService = new NotificationService();
