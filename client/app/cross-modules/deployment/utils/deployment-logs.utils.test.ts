import { describe, expect, it } from "vitest";
import {
  applyStepTimeRange,
  calculateStepDuration,
  DEPLOYMENT_LOG_EVENT_STATUS,
  formatDuration,
  formatStepDuration,
  getDeploymentLogEventBadgeClassName,
  getDeploymentLogEventBadgeStyle,
  getLogTimeRange,
  getPipelineTimeRange,
  getStepStatus,
  getStepTimeRange,
  getStepTimingTooltip,
  getTimeDifference,
  mergeStepTimeRange,
  parseLogLineTimestamp,
  processLogMessage,
} from "./deployment-logs.utils";
import {
  DeploymentEventGroup,
  DeploymentEventType,
} from "@blocks-deployment/models/live-logs";
import type { IBuildEvent } from "@blocks-deployment/models/deployed-logs";

const event = (
  eventGroup: DeploymentEventGroup,
  eventType: DeploymentEventType,
  createdAt: string,
): IBuildEvent =>
  ({ eventGroup, eventType, createdAt }) as unknown as IBuildEvent;

describe("calculateStepDuration", () => {
  it("computes the duration between start and finish", () => {
    const events = [
      event(DeploymentEventGroup.Build, DeploymentEventType.EventStarted, "2024-01-01T00:00:00Z"),
      event(DeploymentEventGroup.Build, DeploymentEventType.EventFinished, "2024-01-01T00:00:05Z"),
    ];
    expect(calculateStepDuration(events, DeploymentEventGroup.Build)).toBe("5.0s");
  });

  it("returns a placeholder when start or end is missing", () => {
    const events = [
      event(DeploymentEventGroup.Build, DeploymentEventType.EventStarted, "2024-01-01T00:00:00Z"),
    ];
    expect(calculateStepDuration(events, DeploymentEventGroup.Build)).toBe("--");
  });

  it("uses EventFailed as an end marker", () => {
    const events = [
      event(DeploymentEventGroup.Sast, DeploymentEventType.EventStarted, "2024-01-01T00:00:00Z"),
      event(DeploymentEventGroup.Sast, DeploymentEventType.EventFailed, "2024-01-01T00:01:00Z"),
    ];
    expect(calculateStepDuration(events, DeploymentEventGroup.Sast)).toBe("1m 0s");
  });
});

describe("formatDuration", () => {
  it("returns a placeholder for negatives", () => {
    expect(formatDuration(-1)).toBe("--");
  });

  it("formats seconds", () => {
    expect(formatDuration(5000)).toBe("5.0s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(65000)).toBe("1m 5s");
  });

  it("formats hours, minutes and seconds", () => {
    expect(formatDuration(3_665_000)).toBe("1h 1m 5s");
  });
});

describe("getStepStatus", () => {
  it("maps started to running", () => {
    expect(getStepStatus(DeploymentEventType.EventStarted)).toBe("running");
  });
  it("maps finished to success", () => {
    expect(getStepStatus(DeploymentEventType.EventFinished)).toBe("success");
  });
  it("maps failed to error", () => {
    expect(getStepStatus(DeploymentEventType.EventFailed)).toBe("error");
  });
  it("defaults to pending", () => {
    expect(getStepStatus(DeploymentEventType.Log)).toBe("pending");
  });
});

describe("processLogMessage", () => {
  it("splits and trims non-empty lines", () => {
    expect(processLogMessage(" a \n\n b ")).toEqual(["a", "b"]);
  });
  it("returns an empty array for non-strings", () => {
    expect(processLogMessage(123 as unknown as string)).toEqual([]);
  });
});

describe("badge styles", () => {
  it("returns a known style for a mapped status", () => {
    expect(getDeploymentLogEventBadgeStyle(DEPLOYMENT_LOG_EVENT_STATUS.PUBLISHED).bg).toBe(
      "bg-green-100",
    );
  });
  it("falls back for an unknown status", () => {
    expect(getDeploymentLogEventBadgeStyle("Nope").bg).toBe("bg-yellow-100");
  });
  it("builds a className string", () => {
    const cls = getDeploymentLogEventBadgeClassName(
      DEPLOYMENT_LOG_EVENT_STATUS.FAILED,
    );
    expect(cls).toContain("bg-red-100");
    expect(cls).toContain("rounded-full");
  });
});

describe("getTimeDifference", () => {
  it("formats seconds", () => {
    expect(getTimeDifference("2024-01-01T00:00:00Z", "2024-01-01T00:00:30Z")).toBe(
      "30s",
    );
  });
  it("formats minutes and seconds", () => {
    expect(getTimeDifference("2024-01-01T00:00:00Z", "2024-01-01T00:01:30Z")).toBe(
      "1m 30s",
    );
  });
  it("formats hours and minutes", () => {
    expect(getTimeDifference("2024-01-01T00:00:00Z", "2024-01-01T02:30:00Z")).toBe(
      "2h 30m",
    );
  });
});

// ─── per-step timings (issue #155) ───────────────────────────────────────────
//
// The page used to subtract the backend poller's createdAt stamps, which are
// quantised to a 5-second loop: a Clone that really took 1.16s reported 7s.
// These cover reading the real Kubernetes per-line timestamps instead.

const k8sLine = (iso: string, text = "working") => `${iso} ${text}`;

const logEvent = (group: DeploymentEventGroup, message: string) => ({
  id: "log",
  buildId: "b1",
  eventType: DeploymentEventType.Log,
  message,
  eventGroup: group,
  createdAt: "2026-08-04T10:27:24Z",
});

const markerEvent = (
  group: DeploymentEventGroup,
  eventType: DeploymentEventType,
  createdAt: string,
) => ({ id: eventType, buildId: "b1", eventType, message: "", eventGroup: group, createdAt });

describe("parseLogLineTimestamp", () => {
  it("reads a nine-digit k8s fraction, truncating to milliseconds", () => {
    expect(parseLogLineTimestamp(k8sLine("2026-08-04T10:27:17.552157025Z"))).toBe(
      new Date("2026-08-04T10:27:17.552Z").getTime(),
    );
  });

  it("reads a prefix with no fraction", () => {
    expect(parseLogLineTimestamp(k8sLine("2026-08-04T10:27:17Z"))).toBe(
      new Date("2026-08-04T10:27:17Z").getTime(),
    );
  });

  it("returns null for a missing, malformed or empty prefix", () => {
    expect(parseLogLineTimestamp("no timestamp here")).toBeNull();
    expect(parseLogLineTimestamp("2026-08-04 10:27:17Z not rfc3339")).toBeNull();
    expect(parseLogLineTimestamp("")).toBeNull();
    expect(parseLogLineTimestamp(undefined as unknown as string)).toBeNull();
  });

  it("requires whitespace after the prefix so a bare timestamp is not mistaken for a line", () => {
    expect(parseLogLineTimestamp("2026-08-04T10:27:17.552157025Z")).toBeNull();
  });
});

describe("getLogTimeRange", () => {
  it("spans min to max, not first to last", () => {
    // Logs from several containers are concatenated, so they are not ordered.
    const range = getLogTimeRange([
      k8sLine("2026-08-04T10:27:18.714271836Z"),
      k8sLine("2026-08-04T10:27:17.552157025Z"),
      k8sLine("2026-08-04T10:27:18.100000000Z"),
    ]);

    expect(range).toEqual({
      startMs: new Date("2026-08-04T10:27:17.552Z").getTime(),
      endMs: new Date("2026-08-04T10:27:18.714Z").getTime(),
    });
  });

  it("ignores unparseable lines rather than failing", () => {
    const range = getLogTimeRange(["no prefix", k8sLine("2026-08-04T10:27:17Z"), ""]);
    expect(range?.startMs).toBe(new Date("2026-08-04T10:27:17Z").getTime());
  });

  it("returns null when nothing is parseable", () => {
    expect(getLogTimeRange(["plain", "lines"])).toBeNull();
    expect(getLogTimeRange([])).toBeNull();
  });
});

describe("getStepTimeRange", () => {
  const group = DeploymentEventGroup.Clone;

  it("prefers log timestamps and reports the real 1.2s, not the poller's 7s", () => {
    const events = [
      markerEvent(group, DeploymentEventType.EventStarted, "2026-08-04T10:27:13Z"),
      logEvent(
        group,
        `${k8sLine("2026-08-04T10:27:17.552157025Z")}\n${k8sLine("2026-08-04T10:27:18.714271836Z")}`,
      ),
      markerEvent(group, DeploymentEventType.EventFinished, "2026-08-04T10:27:20Z"),
    ];

    const range = getStepTimeRange(events, group);
    expect(range?.source).toBe("logs");
    expect((range?.endMs ?? 0) - (range?.startMs ?? 0)).toBe(1162);
    expect(formatStepDuration(range)).toBe("1.2s");
  });

  it("falls back to the poller stamps, marked approximate", () => {
    const events = [
      markerEvent(group, DeploymentEventType.EventStarted, "2026-08-04T15:14:03Z"),
      logEvent(group, "no timestamps on these lines"),
      markerEvent(group, DeploymentEventType.EventFinished, "2026-08-04T15:14:48Z"),
    ];

    const range = getStepTimeRange(events, group);
    expect(range?.source).toBe("events");
    expect(formatStepDuration(range)).toBe("~45s");
  });

  it("resolves a failed step up to its last observed timestamp", () => {
    const events = [
      logEvent(
        group,
        `${k8sLine("2026-08-04T10:29:02.109Z")}\n${k8sLine("2026-08-04T10:31:34.201Z")}`,
      ),
      markerEvent(group, DeploymentEventType.EventFailed, "2026-08-04T10:31:40Z"),
    ];

    expect(formatStepDuration(getStepTimeRange(events, group))).toBe("2m 32s");
  });

  it("returns null when there is neither a log timestamp nor a start/end pair", () => {
    const events = [logEvent(group, "plain line")];
    expect(getStepTimeRange(events, group)).toBeNull();
    expect(formatStepDuration(null)).toBe("--");
  });

  it("ignores events belonging to other steps", () => {
    const events = [
      markerEvent(DeploymentEventGroup.Build, DeploymentEventType.EventStarted, "2026-08-04T10:00:00Z"),
      markerEvent(DeploymentEventGroup.Build, DeploymentEventType.EventFinished, "2026-08-04T10:00:30Z"),
    ];
    expect(getStepTimeRange(events, group)).toBeNull();
  });
});

describe("getPipelineTimeRange", () => {
  const step = (
    name: string,
    startTime: string,
    endTime: string,
    timingSource: "logs" | "events",
  ) =>
    applyStepTimeRange(
      {
        id: name,
        name,
        status: "success" as const,
        eventType: DeploymentEventType.EventFinished,
        eventGroup: DeploymentEventGroup.Build,
      },
      {
        startMs: new Date(startTime).getTime(),
        endMs: new Date(endTime).getTime(),
        source: timingSource,
      },
    );

  it("spans the earliest start to the latest end, not the sum of the steps", () => {
    const range = getPipelineTimeRange([
      step("a", "2026-08-04T10:27:17.552Z", "2026-08-04T10:27:18.714Z", "logs"),
      step("b", "2026-08-04T10:30:00.000Z", "2026-08-04T10:31:34.552Z", "logs"),
    ]);

    expect(formatDuration((range?.endMs ?? 0) - (range?.startMs ?? 0))).toBe("4m 17s");
  });

  it("excludes poller-derived steps so both ends sit on one clock", () => {
    const range = getPipelineTimeRange([
      step("logs", "2026-08-04T10:00:00Z", "2026-08-04T10:00:10Z", "logs"),
      step("events", "2026-08-04T09:00:00Z", "2026-08-04T11:00:00Z", "events"),
    ]);

    expect(range).toEqual({
      startMs: new Date("2026-08-04T10:00:00Z").getTime(),
      endMs: new Date("2026-08-04T10:00:10Z").getTime(),
    });
  });

  it("returns null when no step is log-derived", () => {
    expect(
      getPipelineTimeRange([step("e", "2026-08-04T10:00:00Z", "2026-08-04T10:00:10Z", "events")]),
    ).toBeNull();
  });
});

describe("mergeStepTimeRange", () => {
  const logs = { startMs: 1_000, endMs: 2_000, source: "logs" as const };
  const events = { startMs: 0, endMs: 9_000, source: "events" as const };

  it("lets the first log range displace a poller range outright", () => {
    // Widening instead would keep the early poller stamp and go on reporting
    // the inflated duration this change exists to remove.
    expect(mergeStepTimeRange(events, logs)).toEqual(logs);
  });

  it("never lets a poller range dilute a log range", () => {
    expect(mergeStepTimeRange(logs, events)).toEqual(logs);
  });

  it("widens within a single source", () => {
    expect(
      mergeStepTimeRange(logs, { startMs: 500, endMs: 1_500, source: "logs" }),
    ).toEqual({ startMs: 500, endMs: 2_000, source: "logs" });
  });

  it("keeps whichever side exists when the other is null", () => {
    expect(mergeStepTimeRange(null, logs)).toEqual(logs);
    expect(mergeStepTimeRange(logs, null)).toEqual(logs);
    expect(mergeStepTimeRange(null, null)).toBeNull();
  });
});

describe("formatDuration boundaries", () => {
  it.each([
    [400, "0.4s"],
    [1_162, "1.2s"],
    [5_000, "5.0s"],
    [9_900, "9.9s"],
    [9_960, "10s"],
    [43_000, "43s"],
    [59_700, "1m 0s"],
    [137_000, "2m 17s"],
    [3_843_000, "1h 4m 3s"],
    [-1, "--"],
    [NaN, "--"],
    [Infinity, "--"],
  ])("formats %p as %p", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe("getStepTimingTooltip", () => {
  const base = {
    id: "s",
    name: "Clone",
    status: "success" as const,
    eventType: DeploymentEventType.EventFinished,
    eventGroup: DeploymentEventGroup.Clone,
  };

  it("says outright when the value came from polling", () => {
    const step = applyStepTimeRange(base, {
      startMs: new Date("2026-08-04T15:14:03Z").getTime(),
      endMs: new Date("2026-08-04T15:14:48Z").getTime(),
      source: "events",
    });
    expect(getStepTimingTooltip(step)).toContain("Approximate");
  });

  it("does not hedge a log-derived value", () => {
    const step = applyStepTimeRange(base, {
      startMs: new Date("2026-08-04T10:27:17.552Z").getTime(),
      endMs: new Date("2026-08-04T10:27:18.714Z").getTime(),
      source: "logs",
    });
    expect(getStepTimingTooltip(step)).not.toContain("Approximate");
    expect(getStepTimingTooltip(step)).toContain("Took 1.2s");
  });

  it("has nothing to say without a range", () => {
    expect(getStepTimingTooltip(applyStepTimeRange(base, null))).toBeUndefined();
  });
});

describe("applyStepTimeRange", () => {
  const base = {
    id: "s",
    name: "Sca",
    status: "pending" as const,
    eventType: DeploymentEventType.Log,
    eventGroup: DeploymentEventGroup.Sca,
  };

  it("marks a step with no resolvable timing rather than guessing", () => {
    const step = applyStepTimeRange(base, null);
    expect(step.duration).toBe("--");
    expect(step.timingSource).toBe("none");
    expect(step.startTime).toBeUndefined();
    expect(step.durationMs).toBeUndefined();
  });
});
