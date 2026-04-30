import {
  DeploymentEventType,
  IBuildStep,
  IDeploymentLogsDenormalizedPayload,
} from "@blocks-devops/models/live-logs";

export class LiveLogsService {
  /**
   * calculate duration between two timestamps
   */
  static calculateDuration(startTime: string, endTime: string): string {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();

    if (diffMs < 0) return "0s";

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

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

            if (
              (log.EventType === DeploymentEventType.EventFinished ||
                log.EventType === DeploymentEventType.EventFailed) &&
              existingStep.startTime
            ) {
              existingStep.duration = this.calculateDuration(
                existingStep.startTime,
                log.CreatedAt
              );
            }
          }
        } else {
          const initialLogs = log.EventType === DeploymentEventType.Log
            ? this.processLogMessage(log.Message)
            : [];

          const newStep: IBuildStep = {
            id: stepId,
            name: log.EventGroup,
            status: log.EventType === DeploymentEventType.Log
              ? "pending"
              : this.getStepStatus(log.EventType),
            logs: initialLogs,
            eventType: log.EventType,
            eventGroup: log.EventGroup,
            duration: undefined,
            startTime: log.EventType === DeploymentEventType.EventStarted
              ? log.CreatedAt
              : undefined,
          };

          if (
            (log.EventType === DeploymentEventType.EventFinished ||
              log.EventType === DeploymentEventType.EventFailed) &&
            newStep.startTime
          ) {
            newStep.duration = this.calculateDuration(newStep.startTime, log.CreatedAt);
          }

          stepsMap.set(stepId, newStep);
        }
      } catch (error) {
        console.error(`Error processing log entry at index ${index}:`, error, log);
      }
    });

    sortedLogs.forEach((log) => {
      const stepId = `${log.BuildId}-${log.EventGroup}`;
      const step = stepsMap.get(stepId);

      if (step && log.EventType === DeploymentEventType.EventStarted && !step.startTime) {
        step.startTime = log.CreatedAt;

        if (this.isFinalStatus(step.status) && !step.duration) {
          const endEvent = sortedLogs.find(
            (endLog) =>
              endLog.BuildId === log.BuildId &&
              endLog.EventGroup === log.EventGroup &&
              (endLog.EventType === DeploymentEventType.EventFinished ||
                endLog.EventType === DeploymentEventType.EventFailed)
          );

          if (endEvent) {
            step.duration = this.calculateDuration(log.CreatedAt, endEvent.CreatedAt);
          }
        }
      }
    });

    return Array.from(stepsMap.values());
  }

  /**
   * Update step with live notification data
   */
  static updateStepWithNotification(
    prevSteps: IBuildStep[],
    deploymentMessage: IDeploymentLogsDenormalizedPayload,
  ): IBuildStep[] {
    const stepId = `${deploymentMessage.BuildId}-${deploymentMessage.EventGroup}`;

    const stepExists = prevSteps.some(step => step.id === stepId);
    if (!stepExists) {
      const newStep: IBuildStep = {
        id: stepId,
        name: deploymentMessage.EventGroup,
        status: deploymentMessage.EventType === DeploymentEventType.Log
          ? "running"
          : this.getStepStatus(deploymentMessage.EventType),
        logs: deploymentMessage.EventType === DeploymentEventType.Log
          ? this.processLogMessage(deploymentMessage.Message)
          : [],
        eventType: deploymentMessage.EventType,
        eventGroup: deploymentMessage.EventGroup,
        duration: undefined,
        startTime: deploymentMessage.EventType === DeploymentEventType.EventStarted
          ? deploymentMessage.CreatedAt
          : undefined,
      };
      return [...prevSteps, newStep];
    }

    return prevSteps.map((step) => {
      if (step.id === stepId) {
        const updatedStep = { ...step };

        if (deploymentMessage.EventType === DeploymentEventType.Log) {
          const newLogs = this.processLogMessage(deploymentMessage.Message);
          updatedStep.logs = [...newLogs];
        } else {
          if (deploymentMessage.EventType === DeploymentEventType.EventStarted) {
            updatedStep.startTime = deploymentMessage.CreatedAt;
            updatedStep.status = "running";
            updatedStep.eventType = deploymentMessage.EventType;
          }
          else if (
            deploymentMessage.EventType === DeploymentEventType.EventFinished ||
            deploymentMessage.EventType === DeploymentEventType.EventFailed
          ) {
            if (!this.isFinalStatus(step.status)) {
              updatedStep.status = this.getStepStatus(deploymentMessage.EventType);
              updatedStep.eventType = deploymentMessage.EventType;

              if (updatedStep.startTime) {
                updatedStep.duration = this.calculateDuration(
                  updatedStep.startTime,
                  deploymentMessage.CreatedAt || new Date().toISOString()
                );
              }
            }
          }
        }

        return updatedStep;
      }
      return step;
    });
  }
}
