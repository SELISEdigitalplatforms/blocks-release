import {
  IBuildStep,
  DeploymentEventGroup,
  DeploymentEventType,
} from "@blocks-devops/models/live-logs";
import { IBuildEvent } from "@blocks-devops/models/deployed-logs";
import {
  calculateStepDuration,
  getStepStatus,
  processLogMessage,
} from "@blocks-devops/utils/deployment-logs.utils";

export class DeployedLogsService {
  static processEventsToSteps(events: IBuildEvent[], buildId: string): IBuildStep[] {
    const stepGroups = new Map<DeploymentEventGroup, IBuildStep>();

    events.forEach((event) => {
      const stepId = `${buildId}-${event.eventGroup}`;
      const existingStep = stepGroups.get(event.eventGroup);

      if (event.eventType === DeploymentEventType.Log) {
        const logLines = processLogMessage(event.message);

        if (existingStep) {
          existingStep.logs = [...(existingStep.logs || []), ...logLines];
        } else {
          stepGroups.set(event.eventGroup, {
            id: stepId,
            name: event.eventGroup,
            status: "pending",
            duration: "0s",
            logs: logLines,
            eventType: event.eventType,
            eventGroup: event.eventGroup,
          });
        }
      } else {
        const status = getStepStatus(event.eventType);

        if (existingStep) {
          existingStep.status = status;
          existingStep.eventType = event.eventType;
        } else {
          stepGroups.set(event.eventGroup, {
            id: stepId,
            name: event.eventGroup,
            status,
            duration: "0s",
            logs: [],
            eventType: event.eventType,
            eventGroup: event.eventGroup,
          });
        }
      }
    });

    const steps = Array.from(stepGroups.values()).map((step) => ({
      ...step,
      duration: calculateStepDuration(events, step.eventGroup),
    }));

    return this.sortStepsByOrder(steps);
  }

  /**
   * Sorts steps by their deployment order
   */
  private static sortStepsByOrder(steps: IBuildStep[]): IBuildStep[] {
    const orderMap: Record<DeploymentEventGroup, number> = {
      [DeploymentEventGroup.Clone]: 0,
      [DeploymentEventGroup.Build]: 1,
      [DeploymentEventGroup.Sast]: 2,
      [DeploymentEventGroup.Sca]: 3,
      [DeploymentEventGroup.Deploy]: 4,
    };

    return steps.sort((a, b) => orderMap[a.eventGroup] - orderMap[b.eventGroup]);
  }

  /**
   * Determines which steps should be expanded by default
   */
  static getDefaultExpandedSteps(steps: IBuildStep[]): Set<string> {
    const expandedSteps = new Set<string>();

    // Expand failed steps by default
    steps.forEach((step) => {
      if (step.status === "error") {
        expandedSteps.add(step.id);
      }
    });

    // Also expand the Clone step if it has logs
    const cloneStep = steps.find((step) => step.eventGroup === DeploymentEventGroup.Clone);
    if (cloneStep && cloneStep.logs && cloneStep.logs.length > 0) {
      expandedSteps.add(cloneStep.id);
    }

    return expandedSteps;
  }

  /**
   * Checks if a step should show a chevron (expandable indicator)
   */
  static shouldShowChevron(step: IBuildStep): boolean {
    return !!(step.logs && step.logs.length > 0);
  }
}
