import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { useNavigate } from "react-router-dom";

import { IBuildData, IDeploySettings } from "@blocks-devops/models/deployed-logs";
import { IRepoResponse, RepoCards } from "./repo-cards/repo-cards";
import { NoRepositoryAvailable } from "../deployment-details/shared/no-repository";

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
}

const DeploymentOverview = ({ projects }: DeploymentOverviewProps) => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto min-h-screen w-full">
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
        <h1 className="text-xl font-semibold">Deployment Overview</h1>

        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/devops/alerts")} disabled={true}>
            <div className="flex h-8 w-8 items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <span className="hidden sm:inline">Observability</span>
          </Button>
        </div>
      </div>

      {projects?.length > 0 ? (
        <div className="mb-8 space-y-4">
          {projects?.map((repo, index) => (
            <RepoCards key={index} repo={repo} />
          ))}
        </div>
      ) : (
        <NoRepositoryAvailable />
      )}
    </div>
  );
};

export default DeploymentOverview;
