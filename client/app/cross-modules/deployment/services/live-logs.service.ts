import {
  DeploymentEventType,
  IBuildStep,
  IDeploymentLogsDenormalizedPayload,
  IStepTimeRange,
} from "@blocks-deployment/models/live-logs";
import { IBuildEvent } from "@blocks-deployment/models/deployed-logs";
import {
  applyStepTimeRange,
  getLogTimeRange,
  getStepTimeRange,
  getStoredStepTimeRange,
  mergeStepTimeRange,
} from "@blocks-deployment/utils/deployment-logs.utils";

export class LiveLogsService {
  /**
   * Check if a build step status is final (completed)
   */
  static isFinalStatus(status: IBuildStep["status"]): boolean {
    return status === "success" || status === "error";
  }

  /**
   * Get step status based on event type
   */
  static getStepStatus(eventType: DeploymentEventType): IBuildStep["status"] {
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
  }

  /**
   * Process log message
   */
  static processLogMessage(message: string): string[] {
    if (!message) return [];
    return message.split("\n").filter((line) => line.trim() !== "");
  }

  /**
   * Process historical logs and return formatted build steps
   */
  static processHistoricalLogs(logs: any[]): IBuildStep[] {
    if (!logs || logs.length === 0) return [];

    const sortedLogs = [...logs].sort((a, b) => {
      const timeA = new Date(a.CreatedAt || 0).getTime();
      const timeB = new Date(b.CreatedAt || 0).getTime();
      return timeA - timeB;
    });

    const stepsMap = new Map<string, IBuildStep>();

    sortedLogs.forEach((log, index) => {
      try {
        const stepId = `${log.BuildId}-${log.EventGroup}`;
        const existingStep = stepsMap.get(stepId);

        if (existingStep) {
          if (log.EventType === DeploymentEventType.Log) {
            const newLogs = this.processLogMessage(log.Message);
            existingStep.logs = [...newLogs];
          } else {
            if (!this.isFinalStatus(existingStep.status)) {
              existingStep.status = this.getStepStatus(log.EventType);
              existingStep.eventType = log.EventType;
            }

          }
        } else {
          const initialLogs =
            log.EventType === DeploymentEventType.Log
              ? this.processLogMessage(log.Message)
              : [];

          const newStep: IBuildStep = {
            id: stepId,
            name: log.EventGroup,
            status:
              log.EventType === DeploymentEventType.Log
                ? "pending"
                : this.getStepStatus(log.EventType),
            logs: initialLogs,
            eventType: log.EventType,
            eventGroup: log.EventGroup,
            duration: undefined,
            startTime:
              log.EventType === DeploymentEventType.EventStarted
                ? log.CreatedAt
                : undefined,
          };

          stepsMap.set(stepId, newStep);
        }
      } catch (error) {
        console.error(
          `Error processing log entry at index ${index}:`,
          error,
          log,
        );
      }
    });

    sortedLogs.forEach((log) => {
      const stepId = `${log.BuildId}-${log.EventGroup}`;
      const step = stepsMap.get(stepId);

      if (
        step &&
        log.EventType === DeploymentEventType.EventStarted &&
        !step.startTime
      ) {
        step.startTime = log.CreatedAt;
      }
    });

    // Timings come from the one shared resolver, fed the same camelCase shape the
    // deployed view uses, so a build watched live and the same build reloaded
    // report identical durations rather than two near-misses.
    const events = this.toBuildEvents(sortedLogs);

    return Array.from(stepsMap.values()).map((step) =>
      applyStepTimeRange(step, getStepTimeRange(events, step.eventGroup)),
    );
  }

  /**
   * Notification payloads arrive PascalCased; the shared timing helpers read the
   * camelCase `IBuildEvent` the API returns. Normalise once at this boundary so
   * the helpers cannot silently match nothing and report every step as "--".
   */
  private static toBuildEvents(
    logs: IDeploymentLogsDenormalizedPayload[],
  ): IBuildEvent[] {
    return (logs || []).map((log) => ({
      id: log.Id ?? "",
      buildId: log.BuildId ?? null,
      eventType: log.EventType,
      message: log.Message ?? "",
      eventGroup: log.EventGroup,
      createdAt: log.CreatedAt,
    }));
  }

  /**
   * Update step with live notification data
   */
  static updateStepWithNotification(
    prevSteps: IBuildStep[],
    deploymentMessage: IDeploymentLogsDenormalizedPayload,
  ): IBuildStep[] {
    const stepId = `${deploymentMessage.BuildId}-${deploymentMessage.EventGroup}`;

    const stepExists = prevSteps.some((step) => step.id === stepId);
    if (!stepExists) {
      const newStep: IBuildStep = {
        id: stepId,
        name: deploymentMessage.EventGroup,
        status:
          deploymentMessage.EventType === DeploymentEventType.Log
            ? "running"
            : this.getStepStatus(deploymentMessage.EventType),
        logs:
          deploymentMessage.EventType === DeploymentEventType.Log
            ? this.processLogMessage(deploymentMessage.Message)
            : [],
        eventType: deploymentMessage.EventType,
        eventGroup: deploymentMessage.EventGroup,
      };
      // Resolve timing from the very first payload, so a step that is still
      // running already shows an elapsed value rather than waiting for its
      // finish event.
      return [
        ...prevSteps,
        applyStepTimeRange(newStep, this.observedRange(deploymentMessage)),
      ];
    }

    return prevSteps.map((step) => {
      if (step.id === stepId) {
        const updatedStep = { ...step };

        // A payload replaces this step's log lines rather than appending, so the
        // running range is kept on the step and widened as lines arrive. That is
        // also what makes a running step's elapsed time grow from the newest log
        // timestamp instead of from the wall clock.
        const observed = this.observedRange(deploymentMessage);

        if (deploymentMessage.EventType === DeploymentEventType.Log) {
          const newLogs = this.processLogMessage(deploymentMessage.Message);
          updatedStep.logs = [...newLogs];
        } else {
          if (
            deploymentMessage.EventType === DeploymentEventType.EventStarted
          ) {
            updatedStep.status = "running";
            updatedStep.eventType = deploymentMessage.EventType;
          } else if (
            deploymentMessage.EventType === DeploymentEventType.EventFinished ||
            deploymentMessage.EventType === DeploymentEventType.EventFailed
          ) {
            if (!this.isFinalStatus(step.status)) {
              updatedStep.status = this.getStepStatus(
                deploymentMessage.EventType,
              );
              updatedStep.eventType = deploymentMessage.EventType;
            }
          }
        }

        return applyStepTimeRange(
          updatedStep,
          mergeStepTimeRange(getStoredStepTimeRange(step), observed),
        );
      }
      return step;
    });
  }

  /**
   * The span a single notification payload reveals: the k8s timestamps on its log
   * lines when it carries any, otherwise the poller's own stamp.
   *
   * A payload with neither yields null, so an unresolvable event leaves the step
   * without a duration rather than inventing one from the current time.
   */
  private static observedRange(
    message: IDeploymentLogsDenormalizedPayload,
  ): IStepTimeRange | null {
    // Only Log payloads carry k8s timestamps, and only they are considered when
    // the deployed view resolves the same build. Parsing a marker's message here
    // too would let the two views disagree over the same data.
    if (message.EventType === DeploymentEventType.Log) {
      const logRange = getLogTimeRange(this.processLogMessage(message.Message));
      if (logRange) return { ...logRange, source: "logs" };
      // An untimestamped log line says nothing about when the step ran; the
      // poller's stamp for it is not a substitute.
      return null;
    }

    const stampMs = message.CreatedAt
      ? new Date(message.CreatedAt).getTime()
      : NaN;
    if (!Number.isFinite(stampMs)) return null;

    return { startMs: stampMs, endMs: stampMs, source: "events" };
  }
}
