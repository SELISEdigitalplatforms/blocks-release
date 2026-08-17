import { IBuildEvent } from "@blocks-deployment/models/deployed-logs";
import {
  DeploymentEventType,
  IBuildStep,
  DeploymentEventGroup,
  IStepTimeRange,
} from "@blocks-deployment/models/live-logs";

/**
 * A Kubernetes log line is prefixed with an RFC3339 timestamp, e.g.
 * `2026-08-04T10:27:17.552157025Z clone succeeded`. The fraction is 0-9 digits.
 */
const LOG_LINE_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s/;

/** Milliseconds below which durations are shown with one decimal, e.g. `1.2s`. */
const SUB_SECOND_PRECISION_BELOW_MS = 10_000;

export const DURATION_PLACEHOLDER = "--";
export const APPROXIMATE_PREFIX = "~";

/**
 * Whether a step has reached a state it will not move out of.
 *
 * The single source of truth for "is this step still going". The timing bar asks
 * it so it never claims a step ended while it is still producing output, and both
 * services gate their status updates on the same question.
 */
export const isTerminalStepStatus = (status: IBuildStep["status"]): boolean =>
  status === "success" || status === "error";

/**
 * Divides a log line into its k8s timestamp prefix and the message after it, so
 * the prefix can be rendered dimmed without the message being touched.
 *
 * The line is only ever divided, never rewritten: `timestamp + separator + text`
 * reconstructs the input exactly, for every input, including one with no prefix.
 */
export const splitLogLine = (
  line: string,
): { timestamp: string | null; separator: string; text: string } => {
  if (typeof line !== "string" || line.length === 0) {
    return { timestamp: null, separator: "", text: line || "" };
  }

  const match = LOG_LINE_TIMESTAMP.exec(line);
  if (!match) return { timestamp: null, separator: "", text: line };

  const timestamp = match[1];

  return {
    timestamp,
    // Whatever whitespace the pattern consumed between prefix and message, taken
    // verbatim rather than assumed to be a single space.
    separator: line.slice(timestamp.length, match[0].length),
    text: line.slice(match[0].length),
  };
};

/**
 * Reads the k8s timestamp off the front of a log line.
 *
 * Returns null - never throws - for a missing, malformed or unparseable prefix,
 * so an odd line is simply excluded from a step's range rather than poisoning it.
 */
export const parseLogLineTimestamp = (line: string): number | null => {
  if (typeof line !== "string" || line.length === 0) return null;

  const match = LOG_LINE_TIMESTAMP.exec(line);
  if (!match) return null;

  // Date only honours milliseconds; a 9-digit k8s fraction must be truncated
  // rather than rounded, so the value never drifts past the real instant.
  const truncated = match[1].replace(/\.(\d+)Z$/, (_, digits: string) =>
    `.${digits.slice(0, 3).padEnd(3, "0")}Z`,
  );

  const ms = new Date(truncated).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/**
 * The span covered by a set of log lines.
 *
 * Deliberately min/max rather than first/last: the backend concatenates the logs
 * of several containers per step, so the lines do not arrive in time order.
 */
export const getLogTimeRange = (
  lines: string[],
): { startMs: number; endMs: number } | null => {
  if (!Array.isArray(lines)) return null;

  let startMs = Number.POSITIVE_INFINITY;
  let endMs = Number.NEGATIVE_INFINITY;
  let found = false;

  for (const line of lines) {
    const ms = parseLogLineTimestamp(line);
    if (ms === null) continue;
    found = true;
    if (ms < startMs) startMs = ms;
    if (ms > endMs) endMs = ms;
  }

  return found ? { startMs, endMs } : null;
};

/**
 * Resolves a step's time span, preferring the real k8s log timestamps over the
 * backend poller's stamps. The two are never combined: the poller runs on a 5s
 * loop against a different clock, so mixing them would produce a number that
 * belongs to neither.
 */
export const getStepTimeRange = (
  events: IBuildEvent[],
  eventGroup: DeploymentEventGroup,
): IStepTimeRange | null => {
  if (!Array.isArray(events)) return null;

  const groupEvents = events.filter((event) => event?.eventGroup === eventGroup);

  const logLines = groupEvents
    .filter((event) => event.eventType === DeploymentEventType.Log)
    .flatMap((event) => processLogMessage(event.message));

  const logRange = getLogTimeRange(logLines);
  if (logRange) return { ...logRange, source: "logs" };

  let startMs: number | null = null;
  let endMs: number | null = null;

  for (const event of groupEvents) {
    if (event.eventType === DeploymentEventType.EventStarted) {
      startMs = new Date(event.createdAt).getTime();
    } else if (
      event.eventType === DeploymentEventType.EventFinished ||
      event.eventType === DeploymentEventType.EventFailed
    ) {
      endMs = new Date(event.createdAt).getTime();
    }
  }

  if (
    startMs === null ||
    endMs === null ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs)
  ) {
    return null;
  }

  return { startMs, endMs, source: "events" };
};

/**
 * Wall-clock span of the whole pipeline: the earliest start to the latest end.
 *
 * Only log-derived steps count, so both ends of the total sit on the same clock.
 * Consequence worth knowing: if the missing steps sit at either end of the
 * pipeline, the total understates the real elapsed time.
 */
export const getPipelineTimeRange = (
  steps: IBuildStep[],
): { startMs: number; endMs: number } | null => {
  if (!Array.isArray(steps)) return null;

  let startMs = Number.POSITIVE_INFINITY;
  let endMs = Number.NEGATIVE_INFINITY;
  let found = false;

  for (const step of steps) {
    if (step?.timingSource !== "logs") continue;
    const start = step.startTime
      ? new Date(step.startTime).getTime()
      : Number.NaN;
    const end = step.endTime ? new Date(step.endTime).getTime() : Number.NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    found = true;
    if (start < startMs) startMs = start;
    if (end > endMs) endMs = end;
  }

  return found ? { startMs, endMs } : null;
};

/**
 * Renders a step's duration, marking poller-derived values as approximate so the
 * two clocks are never presented as if they were equally trustworthy.
 */
export const formatStepDuration = (range: IStepTimeRange | null): string => {
  if (!range) return DURATION_PLACEHOLDER;

  // A step that has only reported its start marker has one poller stamp and no
  // span. Showing "~0.0s" would claim it finished instantly; the deployed view
  // shows "--" for the same data, so the live view must too. The range is still
  // stored, so the finish marker widens it into a real duration.
  if (range.source === "events" && range.endMs === range.startMs) {
    return DURATION_PLACEHOLDER;
  }

  const formatted = formatDuration(range.endMs - range.startMs);
  if (formatted === DURATION_PLACEHOLDER) return formatted;

  return range.source === "events" ? `${APPROXIMATE_PREFIX}${formatted}` : formatted;
};

/**
 * Folds a newly observed range into whatever a step already had.
 *
 * Log timestamps always win over poller stamps, and the two are never merged: a
 * step that starts out with a poller range has that range *replaced* the moment
 * real log timestamps appear, rather than widened to span both. Merging them
 * would keep the early poller stamp and go on reporting the inflated duration
 * this ticket exists to remove.
 */
export const mergeStepTimeRange = (
  existing: IStepTimeRange | null,
  incoming: IStepTimeRange | null,
): IStepTimeRange | null => {
  if (!incoming) return existing;
  if (!existing) return incoming;

  if (existing.source === incoming.source) {
    return {
      startMs: Math.min(existing.startMs, incoming.startMs),
      endMs: Math.max(existing.endMs, incoming.endMs),
      source: existing.source,
    };
  }

  return incoming.source === "logs" ? incoming : existing;
};

/** Writes a resolved range onto a step, keeping every timing field in step. */
export const applyStepTimeRange = (
  step: IBuildStep,
  range: IStepTimeRange | null,
): IBuildStep => {
  if (!range) {
    return {
      ...step,
      duration: DURATION_PLACEHOLDER,
      startTime: undefined,
      endTime: undefined,
      durationMs: undefined,
      timingSource: "none",
    };
  }

  return {
    ...step,
    duration: formatStepDuration(range),
    startTime: new Date(range.startMs).toISOString(),
    endTime: new Date(range.endMs).toISOString(),
    durationMs: range.endMs - range.startMs,
    timingSource: range.source,
  };
};

/**
 * Full local start/end plus duration, for the chip's hover tooltip. Poller-derived
 * values say so outright rather than quietly reading as measured.
 *
 * A running step's resolved end is only the newest log line seen so far, so it is
 * labelled "Last output" rather than passed off as a finish time. A step that has
 * not reached a terminal status at all claims nothing about its end.
 */
export const getStepTimingTooltip = (step: IBuildStep): string | undefined => {
  if (!step.startTime || !step.endTime || !step.timingSource) return undefined;
  if (step.timingSource === "none") return undefined;
  if (step.duration === DURATION_PLACEHOLDER) return undefined;

  const start = new Date(step.startTime);
  const end = new Date(step.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return undefined;
  }

  const isRunning = step.status === "running";
  const clauses = [`Started ${start.toLocaleString()}`];

  if (isTerminalStepStatus(step.status)) {
    clauses.push(`Ended ${end.toLocaleString()}`);
  } else if (isRunning) {
    clauses.push(`Last output ${end.toLocaleString()}`);
  }

  clauses.push(`${isRunning ? "Elapsed" : "Took"} ${step.duration}`);

  const base = clauses.join(" · ");

  return step.timingSource === "events"
    ? `${base}\nApproximate — derived from backend polling, not log timestamps.`
    : base;
};

/** The range currently stored on a step, or null when it has none. */
export const getStoredStepTimeRange = (
  step: IBuildStep,
): IStepTimeRange | null => {
  if (!step.startTime) return null;

  const startMs = new Date(step.startTime).getTime();
  if (!Number.isFinite(startMs)) return null;

  // A step that has started but not finished has only one instant to its name.
  // Treat it as a zero-width poller range so the finish event widens it into a
  // real span, instead of the step appearing to have taken no time at all.
  const source =
    step.timingSource === "logs" || step.timingSource === "events"
      ? step.timingSource
      : "events";

  const endMs = step.endTime ? new Date(step.endTime).getTime() : startMs;
  if (!Number.isFinite(endMs)) return null;

  return { startMs, endMs, source };
};

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
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return DURATION_PLACEHOLDER;
  }

  // Below ten seconds, one decimal - the whole point of this ticket is telling
  // a 1.2s step apart from a 7s one, which whole seconds cannot do.
  if (durationMs < SUB_SECOND_PRECISION_BELOW_MS) {
    const tenths = Math.round(durationMs / 100) / 10;
    if (tenths < 10) return `${tenths.toFixed(1)}s`;
  }

  // Rounds rather than floors, so 9.96s reads "10s" and not "9s".
  const seconds = Math.round(durationMs / 1000);
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
