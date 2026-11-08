import { tStatic } from "@seliseblocks/genesis-os";

const MODULE = "release.shared";

// Text is looked up when the options are read, so a language change is picked up.
export const getEnvironmentOptions = () => [
  {
    index: 0,
    label: tStatic(MODULE, "ENVIRONMENT_OPTIONS.DEV_LABEL"),
    value: "dev",
    subtext: tStatic(MODULE, "ENVIRONMENT_OPTIONS.DEV_SUBTEXT"),
  },
  {
    index: 1,
    label: tStatic(MODULE, "ENVIRONMENT_OPTIONS.TEST_LABEL"),
    value: "test",
    subtext: tStatic(MODULE, "ENVIRONMENT_OPTIONS.TEST_SUBTEXT"),
  },
  {
    index: 2,
    label: tStatic(MODULE, "ENVIRONMENT_OPTIONS.STG_LABEL"),
    value: "stg",
    subtext: tStatic(MODULE, "ENVIRONMENT_OPTIONS.STG_SUBTEXT"),
  },
  {
    index: 3,
    label: tStatic(MODULE, "ENVIRONMENT_OPTIONS.IAT_LABEL"),
    value: "iat",
    subtext: tStatic(MODULE, "ENVIRONMENT_OPTIONS.IAT_SUBTEXT"),
  },
  {
    index: 4,
    label: tStatic(MODULE, "ENVIRONMENT_OPTIONS.UAT_LABEL"),
    value: "uat",
    subtext: tStatic(MODULE, "ENVIRONMENT_OPTIONS.UAT_SUBTEXT"),
  },
  {
    index: 5,
    label: tStatic(MODULE, "ENVIRONMENT_OPTIONS.PROD_SHADOW_LABEL"),
    value: "prod-shadow",
    subtext: tStatic(MODULE, "ENVIRONMENT_OPTIONS.PROD_SHADOW_SUBTEXT"),
  },
  {
    index: 6,
    label: tStatic(MODULE, "ENVIRONMENT_OPTIONS.PRE_PROD_LABEL"),
    value: "pre-prod",
    subtext: tStatic(MODULE, "ENVIRONMENT_OPTIONS.PRE_PROD_SUBTEXT"),
  },
  {
    index: 7,
    label: tStatic(MODULE, "ENVIRONMENT_OPTIONS.PROD_LABEL"),
    value: "prod",
    subtext: tStatic(MODULE, "ENVIRONMENT_OPTIONS.PROD_SUBTEXT"),
  },
];
