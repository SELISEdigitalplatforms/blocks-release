import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { useNavigate } from "react-router";

import {
  IBuildData,
  IDeploySettings,
} from "@blocks-deployment/models/deployed-logs";
import { IRepoResponse, RepoCards } from "./repo-cards/repo-cards";
import { NoRepositoryAvailable } from "../deployment-details/shared/no-repository";
import { ErrorRepository } from "../deployment-details/shared/error-repository";

export interface IProject {
  builds: IBuildData[];
  id: string;
  blocksUserId: string;
  projectId: string;
  name: string;
  deploymentUrl: string;
  deploySettings: IDeploySettings;
}

export interface IProjectRepoListEnvWiseResponse {
  data: IRepoResponse[];
  message: string | null;
  statusCode: number;
  errors: string;
  isSuccess: boolean;
}

interface DeploymentOverviewProps {
  projects: IRepoResponse[];
  refetch: () => void;
}

const DeploymentOverview = ({ projects, refetch }: DeploymentOverviewProps) => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto min-h-screen w-full">
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
        <h1 className="text-xl font-semibold">Deployment Overview</h1>
      </div>

      {GetProjectOverview(projects, refetch)}
    </div>
  );
};

export default DeploymentOverview;

function GetProjectOverview(projects: IRepoResponse[], refetch: () => void) {
  if (!projects) {
    return <ErrorRepository refetch={refetch} />;
  }
  if (projects?.length === 0) {
    return <NoRepositoryAvailable />;
  }
  return (
    <div className="mb-8 space-y-4">
      {projects?.map((repo, index) => (
        <RepoCards key={index} repo={repo} />
      ))}
    </div>
  );
}
