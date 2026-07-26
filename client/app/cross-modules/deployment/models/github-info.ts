import githubIcon from "@blocks-deployment/assets/icons/github.png";
import gitlabIcon from "@blocks-deployment/assets/icons/gitlab.png";
import bitbucketIcon from "@blocks-deployment/assets/icons/bitbucket.png";
import azureIcon from "@blocks-deployment/assets/icons/azure-deployment.png";
import awsIcon from "@blocks-deployment/assets/icons/amazon-web-service.png";
import { IBuildData } from "./deployed-logs";
export interface IGithubBranch {
  branchName: string;
}
export interface ICloneRepo {
  repoName: string;
  branch: string;
  deploymentUrl: string;
  hostingProviderId?: string;
  regionId?: string;
  machineConfigId?: string;
  deploymentType?: string;
  repoUrl: string;
  projectName: string;
}

export interface DeploymentFormData {
  customDomain: string;
  lastDeploymentStatus: string;
  deploymentType: "auto" | "manual";
  framework: string;
  provider: string;
  region: string;
  selectedSpec: string;
  providerId?: string;
  regionId?: string;
  machineConfigId?: string;
}

export interface IRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
}

export interface IRepositoryUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  html_url: string;
  login?: string;
}

export interface IBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}
export interface IBranchMatchResponse {
  data: null;
  message: string | null;
  statusCode: number;
  errors: string[] | null;
  isSuccess: boolean;
}

export interface RepositorySelectorProps {
  repositories: IRepository[];
}

interface IconMap {
  [key: string]: string;
}

export const iconMap: IconMap = {
  github: githubIcon,
  gitlab: gitlabIcon,
  bitbucket: bitbucketIcon,
  azure: azureIcon,
  aws: awsIcon,
};
export interface DeploymentData {
  message: string;
  commitId: string;
  id: string;
  environment: string;
  status: "Published" | "Deployed";
  date: string;
  time: string;
  deployedIn: string;
  hasMessage: boolean;
  actions: string[];
}

export interface IRepoDetailsApiErrorResponse {
  data: {
    repo: null;
    build: IBuildData[];
  };
  message: string | null;
  statusCode: number;
  errors: unknown;
  isSuccess: boolean;
}

export interface IHttpError extends Error {
  status: number;
  errors: IRepoDetailsApiErrorResponse;
}
