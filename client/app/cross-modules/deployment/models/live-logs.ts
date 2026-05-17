export interface IBuildStep {
  id: string;
  name: string;
  status: "success" | "error" | "running" | "pending";
  logs?: string[];
  eventType: DeploymentEventType;
  eventGroup: DeploymentEventGroup;
  duration?: string;
  startTime?: string;
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
