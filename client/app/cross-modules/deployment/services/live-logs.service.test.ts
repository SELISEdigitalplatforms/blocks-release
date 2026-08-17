import { describe, expect, it } from "vitest";
import { LiveLogsService } from "./live-logs.service";
import {
  DeploymentEventType,
  DeploymentEventGroup,
} from "@blocks-deployment/models/live-logs";
import { MOCK_BUILD_ID } from "../test-utils/__mocks__";
import { DeployedLogsService } from "./deployed-logs.service";

describe("LiveLogsService", () => {
  // calculateDuration was removed: the live and deployed views now share one
  // duration implementation in deployment-logs.utils, which is where its cases
  // (including the negative-delta one, now "--" rather than "0s") are covered.

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ isFinalStatus Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  // isFinalStatus was removed: the timing bar needs the same predicate and a
  // component must not reach into a service for it, so it now lives in
  // deployment-logs.utils as isTerminalStepStatus, where its cases are covered.

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ getStepStatus Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  describe("getStepStatus", () => {
    it("should map EventStarted to running", () => {
      expect(
        LiveLogsService.getStepStatus(DeploymentEventType.EventStarted),
      ).toBe("running");
    });

    it("should map EventFinished to success", () => {
      expect(
        LiveLogsService.getStepStatus(DeploymentEventType.EventFinished),
      ).toBe("success");
    });

    it("should map EventFailed to error", () => {
      expect(
        LiveLogsService.getStepStatus(DeploymentEventType.EventFailed),
      ).toBe("error");
    });

    it("should return pending for other types", () => {
      expect(LiveLogsService.getStepStatus(DeploymentEventType.Log)).toBe(
        "pending",
      );
    });
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ processLogMessage Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  describe("processLogMessage", () => {
    it("should split multiline message and filter empty lines", () => {
      const message = "line 1\n\nline 2  \n  line 3";
      expect(LiveLogsService.processLogMessage(message)).toEqual([
        "line 1",
        "line 2  ",
        "  line 3",
      ]);
    });

    it("should return empty array for empty message", () => {
      expect(LiveLogsService.processLogMessage("")).toEqual([]);
    });
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ processHistoricalLogs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  describe("processHistoricalLogs", () => {
    it("should return empty array for empty logs", () => {
      expect(LiveLogsService.processHistoricalLogs([])).toEqual([]);
    });

    it("should process historical logs correctly", () => {
      const logs = [
        {
          BuildId: MOCK_BUILD_ID,
          EventGroup: DeploymentEventGroup.Build,
          EventType: DeploymentEventType.EventStarted,
          CreatedAt: "2023-01-01T00:00:00Z",
        },
        {
          BuildId: MOCK_BUILD_ID,
          EventGroup: DeploymentEventGroup.Build,
          EventType: DeploymentEventType.Log,
          Message: "Compiling...",
          CreatedAt: "2023-01-01T00:00:05Z",
        },
        {
          BuildId: MOCK_BUILD_ID,
          EventGroup: DeploymentEventGroup.Build,
          EventType: DeploymentEventType.EventFinished,
          CreatedAt: "2023-01-01T00:00:10Z",
        },
      ];

      const result = LiveLogsService.processHistoricalLogs(logs);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("success");
      expect(result[0].logs).toEqual(["Compiling..."]);
      expect(result[0].duration).toBe("~10s");
    });

    it("should handle logs out of order", () => {
      const logs = [
        {
          BuildId: MOCK_BUILD_ID,
          EventGroup: DeploymentEventGroup.Build,
          EventType: DeploymentEventType.EventFinished,
          CreatedAt: "2023-01-01T00:00:10Z",
        },
        {
          BuildId: MOCK_BUILD_ID,
          EventGroup: DeploymentEventGroup.Build,
          EventType: DeploymentEventType.EventStarted,
          CreatedAt: "2023-01-01T00:00:00Z",
        },
      ];

      const result = LiveLogsService.processHistoricalLogs(logs);
      expect(result[0].status).toBe("success");
      expect(result[0].duration).toBe("~10s");
    });

    it("should calculate duration in the second loop if missing", () => {
      const mixedLogs = [
        {
          BuildId: MOCK_BUILD_ID,
          EventGroup: DeploymentEventGroup.Build,
          EventType: DeploymentEventType.EventStarted,
          CreatedAt: "2023-01-01T00:00:00Z",
        },
        {
          BuildId: MOCK_BUILD_ID,
          EventGroup: DeploymentEventGroup.Build,
          EventType: DeploymentEventType.Log,
          Message: "Log 1",
          CreatedAt: "2023-01-01T00:00:01Z",
        },
        {
          BuildId: MOCK_BUILD_ID,
          EventGroup: DeploymentEventGroup.Build,
          EventType: DeploymentEventType.EventFinished,
          CreatedAt: "2023-01-01T00:00:02Z",
        },
        {
          BuildId: MOCK_BUILD_ID,
          EventGroup: DeploymentEventGroup.Deploy,
          EventType: DeploymentEventType.EventFailed,
          CreatedAt: "2023-01-01T00:00:03Z",
        },
      ];
      const result = LiveLogsService.processHistoricalLogs(mixedLogs);
      expect(result).toHaveLength(2);
    });
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ updateStepWithNotification Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  describe("updateStepWithNotification", () => {
    it("should add new step if it doesn't exist", () => {
      const prevSteps: any[] = [];
      const message = {
        BuildId: MOCK_BUILD_ID,
        EventGroup: DeploymentEventGroup.Clone,
        EventType: DeploymentEventType.EventStarted,
        CreatedAt: "2023-01-01T00:00:00Z",
        Message: "",
      };

      const result = LiveLogsService.updateStepWithNotification(
        prevSteps,
        message,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(`${MOCK_BUILD_ID}-Clone`);
      expect(result[0].status).toBe("running");
    });

    it("should update existing step logs", () => {
      const stepId = `${MOCK_BUILD_ID}-Build`;
      const prevSteps: any[] = [{ id: stepId, logs: [], status: "running" }];
      const message = {
        BuildId: MOCK_BUILD_ID,
        EventGroup: DeploymentEventGroup.Build,
        EventType: DeploymentEventType.Log,
        Message: "Hello World",
        CreatedAt: "2023-01-01T00:00:00Z",
      };

      const result = LiveLogsService.updateStepWithNotification(
        prevSteps,
        message,
      );
      expect(result[0].logs).toEqual(["Hello World"]);
    });

    it("should update existing step status and calculate duration", () => {
      const stepId = `${MOCK_BUILD_ID}-Build`;
      const prevSteps: any[] = [
        { id: stepId, status: "running", startTime: "2023-01-01T00:00:00Z" },
      ];
      const message = {
        BuildId: MOCK_BUILD_ID,
        EventGroup: DeploymentEventGroup.Build,
        EventType: DeploymentEventType.EventFinished,
        CreatedAt: "2023-01-01T00:00:10Z",
        Message: "",
      };

      const result = LiveLogsService.updateStepWithNotification(
        prevSteps,
        message,
      );
      expect(result[0].status).toBe("success");
      expect(result[0].duration).toBe("~10s");
    });

    it("should update existing step when EventStarted occurs", () => {
      const stepId = `${MOCK_BUILD_ID}-Build`;
      const prevSteps: any[] = [{ id: stepId, status: "pending" }];
      const message = {
        BuildId: MOCK_BUILD_ID,
        EventGroup: DeploymentEventGroup.Build,
        EventType: DeploymentEventType.EventStarted,
        CreatedAt: "2023-01-01T00:00:00Z",
        Message: "",
      };

      const result = LiveLogsService.updateStepWithNotification(
        prevSteps,
        message,
      );
      expect(result[0].status).toBe("running");
      expect(result[0].startTime).toBe("2023-01-01T00:00:00.000Z");
    });

    it("should not update status if already final", () => {
      const stepId = `${MOCK_BUILD_ID}-Build`;
      const prevSteps: any[] = [{ id: stepId, status: "success" }];
      const message = {
        BuildId: MOCK_BUILD_ID,
        EventGroup: DeploymentEventGroup.Build,
        EventType: DeploymentEventType.EventFailed,
        CreatedAt: "2023-01-01T00:00:10Z",
        Message: "",
      };

      const result = LiveLogsService.updateStepWithNotification(
        prevSteps,
        message,
      );
      expect(result[0].status).toBe("success");
    });

    it("should return unchanged step if ID doesn't match", () => {
      const prevSteps: any[] = [{ id: "other-id", status: "running" }];
      const message = {
        BuildId: MOCK_BUILD_ID,
        EventGroup: DeploymentEventGroup.Build,
        EventType: DeploymentEventType.Log,
        Message: "Hello",
        CreatedAt: "2023-01-01T00:00:00Z",
      };

      const result = LiveLogsService.updateStepWithNotification(
        prevSteps,
        message,
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("other-id");
      expect(result[1].id).toBe(`${MOCK_BUILD_ID}-Build`);
    });
  });
});

// â”€â”€â”€ live / deployed parity (issue #155, H6) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("live and deployed views agree", () => {
  const k8s = (iso: string) => `${iso} working`;

  const camel = [
    {
      id: "1",
      buildId: MOCK_BUILD_ID,
      eventGroup: DeploymentEventGroup.Clone,
      eventType: DeploymentEventType.EventStarted,
      message: "",
      createdAt: "2026-08-04T10:27:13Z",
    },
    {
      id: "2",
      buildId: MOCK_BUILD_ID,
      eventGroup: DeploymentEventGroup.Clone,
      eventType: DeploymentEventType.Log,
      message: `${k8s("2026-08-04T10:27:17.552157025Z")}\n${k8s("2026-08-04T10:27:18.714271836Z")}`,
      createdAt: "2026-08-04T10:27:18Z",
    },
    {
      id: "3",
      buildId: MOCK_BUILD_ID,
      eventGroup: DeploymentEventGroup.Clone,
      eventType: DeploymentEventType.EventFinished,
      message: "",
      createdAt: "2026-08-04T10:27:20Z",
    },
  ];

  // The notification pipeline delivers the same events PascalCased. If the live
  // path failed to normalise them the shared resolver would match nothing and
  // silently report "--", which is exactly the trap this pins.
  const pascal = camel.map((e) => ({
    Id: e.id,
    BuildId: e.buildId,
    EventGroup: e.eventGroup,
    EventType: e.eventType,
    Message: e.message,
    CreatedAt: e.createdAt,
  }));

  it("reports the same log-derived duration from either path", () => {
    const live = LiveLogsService.processHistoricalLogs(pascal);
    const deployed = DeployedLogsService.processEventsToSteps(camel, MOCK_BUILD_ID);

    expect(live[0].duration).toBe("1.2s");
    expect(live[0].timingSource).toBe("logs");
    expect(deployed[0].duration).toBe(live[0].duration);
    expect(deployed[0].startTime).toBe(live[0].startTime);
    expect(deployed[0].endTime).toBe(live[0].endTime);
  });

  it("does not fall back to the poller stamps when logs are available", () => {
    const live = LiveLogsService.processHistoricalLogs(pascal);
    // 10:27:13 -> 10:27:20 is the poller's 7s; the real work took 1.162s.
    expect(live[0].duration).not.toBe("7s");
    expect(live[0].durationMs).toBe(1162);
  });

  it("grows a running step's elapsed time from the newest log line, not the clock", () => {
    const first = LiveLogsService.updateStepWithNotification([], {
      BuildId: MOCK_BUILD_ID,
      EventGroup: DeploymentEventGroup.Build,
      EventType: DeploymentEventType.Log,
      Message: `${k8s("2026-08-04T10:29:35.480Z")}`,
      CreatedAt: "2026-08-04T10:29:36Z",
    });

    const later = LiveLogsService.updateStepWithNotification(first, {
      BuildId: MOCK_BUILD_ID,
      EventGroup: DeploymentEventGroup.Build,
      EventType: DeploymentEventType.Log,
      Message: `${k8s("2026-08-04T10:29:41.880Z")}`,
      CreatedAt: "2026-08-04T10:29:42Z",
    });

    // Payloads replace the log lines rather than appending, so this only holds
    // because the range is carried on the step and widened.
    expect(later[0].duration).toBe("6.4s");
    expect(later[0].timingSource).toBe("logs");
  });

  it("leaves a step with no usable timestamps as a placeholder", () => {
    const steps = LiveLogsService.processHistoricalLogs([
      {
        BuildId: MOCK_BUILD_ID,
        EventGroup: DeploymentEventGroup.Sca,
        EventType: DeploymentEventType.Log,
        Message: "no timestamp on this line",
        CreatedAt: "",
      },
    ]);

    expect(steps[0].duration).toBe("--");
    expect(steps[0].timingSource).toBe("none");
  });
});

