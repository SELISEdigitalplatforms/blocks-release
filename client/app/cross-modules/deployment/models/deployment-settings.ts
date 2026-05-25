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

export const DEPLOYMENT_OPTIONS_DETAILS = [
  { value: "auto", label: "Git based deployment" },
  { value: "manual", label: "Blocks Cloud based deployment" },
];
