/* API Interface: build?buildId= */

import { DeploymentEventGroup, DeploymentEventType } from "./live-logs";

export interface IBuildApiResponse {
  data: IBuildApiResponse | undefined;
  repo: IRepoData;
  build: IBuildData;
}
export interface IRepoData {
  id: string;
  blocksUserId: string;
  projectId: string;
  name: string;
  deploymentUrl: string;
  deploySettings: IDeploySettings;
}
export interface IDeploySettings {
  hostingProvider: IHostingProvider;
  region: IRegion;
  machineConfig: IMachineSpec;
  deploymentType: string;
}

export interface IMachineSpec {
  id: string;
  ram: string;
  cpu: string;
  bandwidth: string;
  status: string;
}

export interface IRegion {
  id: string;
  name: string;
  status: string;
  machineSpecs: IMachineSpec[];
}

export interface IHostingProvider {
  id: string;
  name: string;
  status: string;
  region: IRegion[];
}

export interface IBuildData {
  id: string;
  blocksUserId: string;
  repoId: string;
  commit: string | null;
  branch: string;
  imageName: string;
  status: string;
  eventName: string;
  duration: number;
  createdAt: string;
  buildImageName: string | null;
  pipelineRunName: string;
  events: IBuildEvent[];
}

export interface IBuildEvent {
  id: string;
  buildId: string | null;
  eventType: DeploymentEventType;
  message: string;
  eventGroup: DeploymentEventGroup;
  createdAt: string;
}

export interface DeployedLogsProps {
  logType?: string;
  buildId?: string;
}
