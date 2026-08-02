
// IProject is now owned by blocks-kit (0.0.54 reshaped it: `applicationDomain`
// became `applications: IDomain[]`). Re-export blocks-kit's type as the single
// source of truth so this app's values stay assignable to blocks-kit APIs.
import type { IProject, IDomain } from "@seliseblocks/genesis-os";
export type { IProject, IDomain };

export interface IResource {
  name: string;
  link: string;
  resourceId: string;
}
export interface IProjectGroup {
  tenantGroupId: string;
  projects: IProject[];
}
export interface IGetProjectPayload {
  projectId: string;
}
export interface IGetProjectResponse {
  data: IProject;
  errors: unknown | null;
}

export interface IEnvRepository {
  itemId: string;
  repoName: string;
  repoUrl: string;
  defaultDeploymentUrl: string;
  customDeploymentUrl: string;
  lastDeploymentDate: string;
}













