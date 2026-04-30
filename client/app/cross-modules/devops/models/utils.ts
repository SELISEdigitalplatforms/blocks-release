import { IProject } from "@blocks-devops/components/devops-home/deployment-overview";
import { IProvider, IRegion } from "./deployment-settings";
import { DeploymentFormData } from "./github-info";
import { IDeploymentLogsDenormalizedPayload } from "./live-logs";

export interface IBuild {
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
  lastUpdatedAt: string;
  buildImageName: string | null;
  pipelineRunName: string;
  html_url: string | null;
  events: IDeploymentLogsDenormalizedPayload[];
  repoName: string;
  repoUrl: string;
}

interface MachineSpec {
  id: string;
  ram: string;
  cpu: string;
  bandwidth: string;
  status: string;
}

interface DeploySettings {
  hostingProvider: IProvider;
  region: IRegion;
  machineConfig: MachineSpec;
  deploymentType: string;
}

export interface CardRepoAndBranchesResponse {
  builds: IBuild[];
  id: string;
  blocksUserId: string;
  projectId: string;
  projectName: string | null;
  name: string;
  url: string | null;
  deploymentUrl: string;
  branch: string | null;
  commit: string | null;
  createDate: string;
  lastUpdateDate: string;
  deploySettings: DeploySettings;
}

export interface IChangeSettings {
  deploymentType: "auto" | "manual";
  hostingProviderId: string;
  machineConfigId: string;
  regionId: string;
  repoId: string;
}

export interface IChangeRepoSpecs {
  repoId: string;
  projectKey: string;
  projectEnv?: string;
  projectName?: string;
  deploymentType?: "auto" | "manual";
  hostingProviderId?: string;
  machineConfigId?: string;
  regionId?: string;
}


export interface IAllProjectsResponse {
  data: IProject[];
  isLoading: boolean;
  isError: boolean;
  error: any;
  refetch: () => void;
}

export interface IDeploymentSettingsProps {
  selectedRepo: string | null;
  selectedBranch: string | null;
  specsData: IProvider[] | undefined;
  deploymentData: DeploymentFormData;
  onDeploymentDataChange: (data: DeploymentFormData) => void;
}

export interface IProviderDestination {
  destination: string;
}
export interface IManualDeploymentPayload {
  repoId: string;
  ProjectKey: string;
}
