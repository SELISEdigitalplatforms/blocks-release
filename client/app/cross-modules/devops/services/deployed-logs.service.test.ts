import { describe, expect, it } from "vitest";
import { DeployedLogsService } from "./deployed-logs.service";
import { DeploymentEventType, DeploymentEventGroup } from "@blocks-devops/models/live-logs";
import { IBuildEvent } from "@blocks-devops/models/deployed-logs";
import { MOCK_BUILD_ID } from "../test-utils/__mocks__";

describe("DeployedLogsService", () => {
  // ─── processEventsToSteps ──────────────────────────────────────────────────

  describe("processEventsToSteps", () => {
    it("should process events into steps and sort them", () => {
      const events: IBuildEvent[] = [
        {
          id: "event-1",
          buildId: MOCK_BUILD_ID,
          eventGroup: DeploymentEventGroup.Build,
          eventType: DeploymentEventType.EventStarted,
          message: "Build started",
          createdAt: "2023-01-01T00:00:05Z",
        },
        {
          id: "event-2",
          buildId: MOCK_BUILD_ID,
          eventGroup: DeploymentEventGroup.Clone,
          eventType: DeploymentEventType.EventFinished,
          message: "Clone finished",
          createdAt: "2023-01-01T00:00:00Z",
        },
      ];

      const steps = DeployedLogsService.processEventsToSteps(events, MOCK_BUILD_ID);

      expect(steps).toHaveLength(2);
      // Verify sorting: Clone should be first
      expect(steps[0].eventGroup).toBe(DeploymentEventGroup.Clone);
      expect(steps[1].eventGroup).toBe(DeploymentEventGroup.Build);
    });

    it("should aggregate logs for the same step", () => {
      const events: IBuildEvent[] = [
        {
          id: "event-1",
          buildId: MOCK_BUILD_ID,
          eventGroup: DeploymentEventGroup.Build,
          eventType: DeploymentEventType.Log,
          message: "Line 1",
          createdAt: "2023-01-01T00:00:00Z",
        },
        {
          id: "event-2",
          buildId: MOCK_BUILD_ID,
          eventGroup: DeploymentEventGroup.Build,
          eventType: DeploymentEventType.Log,
          message: "Line 2",
          createdAt: "2023-01-01T00:00:05Z",
        },
      ];

      const steps = DeployedLogsService.processEventsToSteps(events, MOCK_BUILD_ID);
      expect(steps[0].logs).toEqual(["Line 1", "Line 2"]);
    });

    it("should update existing step status when non-log event occurs", () => {
      const events: IBuildEvent[] = [
        {
          id: "event-1",
          buildId: MOCK_BUILD_ID,
          eventGroup: DeploymentEventGroup.Build,
          eventType: DeploymentEventType.EventStarted,
          message: "Started",
          createdAt: "2023-01-01T00:00:00Z",
        },
        {
          id: "event-2",
          buildId: MOCK_BUILD_ID,
          eventGroup: DeploymentEventGroup.Build,
          eventType: DeploymentEventType.EventFinished,
          message: "Finished",
          createdAt: "2023-01-01T00:00:10Z",
        },
      ];

      const steps = DeployedLogsService.processEventsToSteps(events, MOCK_BUILD_ID);
      expect(steps[0].status).toBe("success");
    });
  });

  // ─── getDefaultExpandedSteps ───────────────────────────────────────────────

  describe("getDefaultExpandedSteps", () => {
    it("should expand error steps", () => {
      const steps: any[] = [
        { id: "s1", status: "error", eventGroup: DeploymentEventGroup.Build },
        { id: "s2", status: "success", eventGroup: DeploymentEventGroup.Deploy },
      ];

      const expanded = DeployedLogsService.getDefaultExpandedSteps(steps);
      expect(expanded.has("s1")).toBe(true);
      expect(expanded.has("s2")).toBe(false);
    });

    it("should expand Clone step if it has logs", () => {
      const steps: any[] = [
        { id: "s1", status: "success", eventGroup: DeploymentEventGroup.Clone, logs: ["Cloning..."] },
      ];

      const expanded = DeployedLogsService.getDefaultExpandedSteps(steps);
      expect(expanded.has("s1")).toBe(true);
    });

    it("should not expand Clone step if it has no logs", () => {
      const steps: any[] = [
        { id: "s1", status: "success", eventGroup: DeploymentEventGroup.Clone, logs: [] },
      ];

      const expanded = DeployedLogsService.getDefaultExpandedSteps(steps);
      expect(expanded.has("s1")).toBe(false);
    });
  });

  // ─── shouldShowChevron ─────────────────────────────────────────────────────

  describe("shouldShowChevron", () => {
    it("should return true if step has logs", () => {
      const step: any = { logs: ["log 1"] };
      expect(DeployedLogsService.shouldShowChevron(step)).toBe(true);
    });

    it("should return false if step has no logs", () => {
      const step: any = { logs: [] };
      expect(DeployedLogsService.shouldShowChevron(step)).toBe(false);

      const stepNoLogs: any = {};
      expect(DeployedLogsService.shouldShowChevron(stepNoLogs)).toBe(false);
    });
  });
});
