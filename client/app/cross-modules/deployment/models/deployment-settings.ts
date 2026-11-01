export interface IMachineSpec {
  id: string | null;
  ram: string;
  cpu: string;
  bandwidth: string;
  status: string;
}

export interface IRegion {
  id: string | null;
  name: string;
  status: string;
  machineSpecs: IMachineSpec[];
}

export interface IProvider {
  id: string;
  name: string;
  status: string;
  region: IRegion[];
}

export const DEPLOYMENT_OPTIONS = [
  { value: "auto", label: "Git based deployment" },
  { value: "manual", label: "Blocks Cloud based deployment" },
];

/** Where a repository with a custom domain is deployed. Offered only once a custom domain is set. */
export const DOMAIN_OPTIONS = [
  { value: "both", label: "Default and custom domain" },
  { value: "custom", label: "Custom domain only" },
];

export const DEPLOYMENT_OPTIONS_DETAILS = [
  { value: "auto", label: "Git based deployment" },
  { value: "manual", label: "Blocks Cloud based deployment" },
];
