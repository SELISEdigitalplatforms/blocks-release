import { describe, expect, it } from "vitest";
import {
  calculateStepDuration,
  DEPLOYMENT_LOG_EVENT_STATUS,
  formatDuration,
  getDeploymentLogEventBadgeClassName,
  getDeploymentLogEventBadgeStyle,
  getStepStatus,
  getTimeDifference,
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
    expect(calculateStepDuration(events, DeploymentEventGroup.Build)).toBe("5s");
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
    expect(formatDuration(5000)).toBe("5s");
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
