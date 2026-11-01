import { tStatic } from "@seliseblocks/genesis-os";

const MODULE = "release.deployment.shared";

// Labels are read when shown (getter), so they follow the chosen language.
const gitBasedLabel = () => tStatic(MODULE, "DEPLOYMENT_SETTINGS.GIT_BASED");
const cloudBasedLabel = () => tStatic(MODULE, "DEPLOYMENT_SETTINGS.CLOUD_BASED");

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
  {
    value: "auto",
    get label() {
      return gitBasedLabel();
    },
  },
  {
    value: "manual",
    get label() {
      return cloudBasedLabel();
    },
  },
];

/** Where a repository with a custom domain is deployed. Offered only once a custom domain is set. */
export const DOMAIN_OPTIONS = [
  {
    value: "both",
    get label() {
      return tStatic(MODULE, "DEPLOYMENT_SETTINGS.DOMAIN_BOTH");
    },
  },
  {
    value: "custom",
    get label() {
      return tStatic(MODULE, "DEPLOYMENT_SETTINGS.DOMAIN_CUSTOM_ONLY");
    },
  },
];

export const DEPLOYMENT_OPTIONS_DETAILS = [
  {
    value: "auto",
    get label() {
      return gitBasedLabel();
    },
  },
  {
    value: "manual",
    get label() {
      return cloudBasedLabel();
    },
  },
];
