import { IBuildEvent } from "@blocks-deployment/models/deployed-logs";
import {
  DeploymentEventType,
  IBuildStep,
  DeploymentEventGroup,
} from "@blocks-deployment/models/live-logs";

/**
 * Calculate duration between EventStarted and EventFailed/EventFinished
 */
export const calculateStepDuration = (
  events: IBuildEvent[],
  eventGroup: DeploymentEventGroup,
): string => {
  let startTime: string | null = null;
  let endTime: string | null = null;

  for (const event of events) {
    if (event.eventGroup === eventGroup) {
      if (event.eventType === DeploymentEventType.EventStarted) {
        startTime = event.createdAt;
      } else if (
        event.eventType === DeploymentEventType.EventFailed ||
        event.eventType === DeploymentEventType.EventFinished
      ) {
        endTime = event.createdAt;
      }
    }
  }

  if (!startTime || !endTime) {
    return "--";
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();

  return formatDuration(durationMs);
};

/**
 * Format duration in milliseconds to readable format
 */
export const formatDuration = (durationMs: number): string => {
  if (durationMs < 0) return "--";

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Maps deployment event types to build step status
 */
export const getStepStatus = (
  eventType: DeploymentEventType,
): IBuildStep["status"] => {
  switch (eventType) {
    case DeploymentEventType.EventStarted:
      return "running";
    case DeploymentEventType.EventFinished:
      return "success";
    case DeploymentEventType.EventFailed:
      return "error";
    default:
      return "pending";
  }
};

/**
 * Processes log messages by splitting into lines and filtering empty ones
 */
export const processLogMessage = (message: string): string[] => {
  if (typeof message !== "string") {
    return [];
  }

  return message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

export const DEPLOYMENT_LOG_EVENT_STATUS = {
  PENDING: "Pending",
  PUBLISHED: "Published",
  PASSED: "Passed",
  RUNNING: "Running",
  STARTED: "Started",
  COMPLETED: "Completed",
  SUCCESS: "Succeeded",
  FAILED: "Failed",
  UNKNOWN: "Unknown",
  ERROR: "Error",
  NO_BUILD: "NoBuild",
  // Additional status mappings
  EVENT_STARTED: "EventStarted",
  EVENT_FINISHED: "EventFinished",
  EVENT_FAILED: "EventFailed",
};

export function getDeploymentLogEventBadgeStyle(status: string) {
  const styles = {
    [DEPLOYMENT_LOG_EVENT_STATUS.PENDING]: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      hoverBg: "hover:bg-gray-100",
      hoverText: "hover:text-gray-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.PUBLISHED]: {
      bg: "bg-green-100",
      text: "text-green-800",
      hoverBg: "hover:bg-green-100",
      hoverText: "hover:text-green-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.PASSED]: {
      bg: "bg-green-100",
      text: "text-green-800",
      hoverBg: "hover:bg-green-100",
      hoverText: "hover:text-green-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.RUNNING]: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      hoverBg: "hover:bg-blue-100",
      hoverText: "hover:text-blue-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.STARTED]: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      hoverBg: "hover:bg-blue-100",
      hoverText: "hover:text-blue-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.COMPLETED]: {
      bg: "bg-green-100",
      text: "text-green-800",
      hoverBg: "hover:bg-green-100",
      hoverText: "hover:text-green-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.SUCCESS]: {
      bg: "bg-green-100",
      text: "text-green-800",
      hoverBg: "hover:bg-green-100",
      hoverText: "hover:text-green-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.FAILED]: {
      bg: "bg-red-100",
      text: "text-red-800",
      hoverBg: "hover:bg-red-100",
      hoverText: "hover:text-red-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.UNKNOWN]: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      hoverBg: "hover:bg-gray-100",
      hoverText: "hover:text-gray-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.ERROR]: {
      bg: "bg-red-100",
      text: "text-red-800",
      hoverBg: "hover:bg-red-100",
      hoverText: "hover:text-red-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.EVENT_STARTED]: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      hoverBg: "hover:bg-blue-100",
      hoverText: "hover:text-blue-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.EVENT_FINISHED]: {
      bg: "bg-green-100",
      text: "text-green-800",
      hoverBg: "hover:bg-green-100",
      hoverText: "hover:text-green-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.EVENT_FAILED]: {
      bg: "bg-red-100",
      text: "text-red-800",
      hoverBg: "hover:bg-red-100",
      hoverText: "hover:text-red-800",
    },
    [DEPLOYMENT_LOG_EVENT_STATUS.NO_BUILD]: {
      bg: "bg-secondary",
      text: "text-medium-emphasis",
      hoverBg: "hover:bg-secondary",
      hoverText: "hover:text-medium-emphasis",
    },
  };

  return (
    styles[status] || {
      bg: "bg-yellow-100",
      text: "text-yellow-700",
      hoverBg: "hover:bg-yellow-100",
      hoverText: "hover:text-yellow-700",
    }
  );
}
export function getDeploymentLogEventBadgeClassName(status: string) {
  const style = getDeploymentLogEventBadgeStyle(status);
  return `inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text} ${style.hoverBg} ${style.hoverText}`;
}

export const getTimeDifference = (
  start: string | number | Date,
  end: string | number | Date,
) => {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  if (diffSeconds < 60) {
    return `${diffSeconds}s`;
  }
  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(diffSeconds / 3600);
  const remainingSeconds = diffSeconds % 3600;
  const minutes = Math.floor(remainingSeconds / 60);
  return `${hours}h ${minutes}m`;
};
