import { describe, expect, it } from "vitest";
import { LiveLogsService } from "./live-logs.service";
import {
  DeploymentEventType,
  DeploymentEventGroup,
} from "@blocks-deployment/models/live-logs";
import { MOCK_BUILD_ID } from "../test-utils/__mocks__";

describe("LiveLogsService", () => {
  // ─── calculateDuration ─────────────────────────────────────────────────────

  describe("calculateDuration", () => {
    it("should calculate seconds correctly", () => {
      const start = "2023-01-01T00:00:00Z";
      const end = "2023-01-01T00:00:10Z";
      expect(LiveLogsService.calculateDuration(start, end)).toBe("10s");
    });

    it("should calculate minutes correctly", () => {
      const start = "2023-01-01T00:00:00Z";
      const end = "2023-01-01T00:01:30Z";
      expect(LiveLogsService.calculateDuration(start, end)).toBe("1m 30s");
    });

    it("should calculate hours correctly", () => {
      const start = "2023-01-01T00:00:00Z";
      const end = "2023-01-01T01:05:10Z";
      expect(LiveLogsService.calculateDuration(start, end)).toBe("1h 5m 10s");
    });

    it("should return 0s for negative duration", () => {
      const start = "2023-01-01T00:00:10Z";
      const end = "2023-01-01T00:00:00Z";
      expect(LiveLogsService.calculateDuration(start, end)).toBe("0s");
    });
  });

  // ─── isFinalStatus ─────────────────────────────────────────────────────────

  describe("isFinalStatus", () => {
    it("should return true for success and error", () => {
      expect(LiveLogsService.isFinalStatus("success")).toBe(true);
      expect(LiveLogsService.isFinalStatus("error")).toBe(true);
    });

    it("should return false for pending and running", () => {
      expect(LiveLogsService.isFinalStatus("pending")).toBe(false);
      expect(LiveLogsService.isFinalStatus("running")).toBe(false);
    });
  });

  // ─── getStepStatus ──────────────────────────────────────────────────────────

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

  // ─── processLogMessage ──────────────────────────────────────────────────────

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

  // ─── processHistoricalLogs ──────────────────────────────────────────────────

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
      expect(result[0].duration).toBe("10s");
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
      expect(result[0].duration).toBe("10s");
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

  // ─── updateStepWithNotification ─────────────────────────────────────────────

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
      expect(result[0].duration).toBe("10s");
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
      expect(result[0].startTime).toBe("2023-01-01T00:00:00Z");
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
