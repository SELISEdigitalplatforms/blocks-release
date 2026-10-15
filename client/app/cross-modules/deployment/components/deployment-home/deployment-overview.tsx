import { PageHeader } from "@/components/page-header/page-header";

import { IBuildData, IDeploySettings } from "@blocks-deployment/models/deployed-logs";
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
  return (
    <div className="mx-auto min-h-screen w-full">
      <PageHeader
        title="Deployment Overview"
        description="Build and deploy repositories for this project."
      />

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
    <div className="mb-8 space-y-3">
      {projects?.map((repo, index) => (
        <RepoCards key={index} repo={repo} />
      ))}
    </div>
  );
}
