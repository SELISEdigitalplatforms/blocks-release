/**
 * Where a step's timing came from. "logs" is the real Kubernetes per-line
 * timestamp; "events" is the backend poller's 5-second loop and is therefore
 * only ever approximate.
 */
export type TimingSource = "logs" | "events" | "none";

export interface IStepTimeRange {
  startMs: number;
  endMs: number;
  source: "logs" | "events";
}

export interface IBuildStep {
  id: string;
  name: string;
  status: "success" | "error" | "running" | "pending";
  logs?: string[];
  eventType: DeploymentEventType;
  eventGroup: DeploymentEventGroup;
  /** Formatted for display; prefixed "~" when derived from poller stamps. */
  duration?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  timingSource?: TimingSource;
}

export interface IDeploymentLogsDenormalizedPayload {
  Id?: string;
  BuildId: string;
  EventType: DeploymentEventType;
  Message: string;
  EventGroup: DeploymentEventGroup;
  CreatedAt: string;
}

export enum DeploymentEventType {
  EventStarted = "EventStarted",
  EventFinished = "EventFinished",
  EventFailed = "EventFailed",
  Log = "Log",
}

export enum DeploymentEventGroup {
  Clone = "Clone",
  Build = "Build",
  Sast = "Sast",
  Sca = "Sca",
  Deploy = "Deploy",
}

export interface NotificationData {
  message: {
    denormalizedPayload:
      | string
      | {
          Message: IDeploymentLogsDenormalizedPayload;
        };
  };
}
