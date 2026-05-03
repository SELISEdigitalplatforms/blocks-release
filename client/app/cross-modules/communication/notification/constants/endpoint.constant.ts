import { API_BASE } from "@/constants/endpoint.constant";

export const NOTIFICATION_ENDPOINTS = {
  GET_NOTIFICATIONS: `${API_BASE}/Notifier/GetNotifications`,
  MARK_AS_READ: `${API_BASE}/Notifier/MarkNotificationAsRead`,
  MARK_ALL_AS_READ: `${API_BASE}/Notifier/MarkAllNotificationAsRead`,
} as const;

export const NOTIFICATION_CONFIG_ENDPOINTS = {
  GET_CONFIGS: `${API_BASE}/Notification/Gets`,
  SAVE_CONFIG: `${API_BASE}/Notification/Save`,
  DELETE_CONFIG: `${API_BASE}/Notification/Delete`,
} as const;
