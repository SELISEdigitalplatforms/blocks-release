// These hit the logic server, which `serviceInstances.logicService` is already
// pointed at (baseURL = BLOCKS_LOGIC_APP_URL), so the paths are relative to it.
const NOTIFIER_BASE = "/api/Notifier";
const NOTIFICATION_BASE = "/api/Notification";

export const NOTIFICATION_ENDPOINTS = {
  GET_NOTIFICATIONS: `${NOTIFIER_BASE}/GetNotifications`,
  MARK_AS_READ: `${NOTIFIER_BASE}/MarkNotificationAsRead`,
  MARK_ALL_AS_READ: `${NOTIFIER_BASE}/MarkAllNotificationAsRead`,
} as const;

export const NOTIFICATION_CONFIG_ENDPOINTS = {
  GET_CONFIGS: `${NOTIFICATION_BASE}/Gets`,
} as const;
