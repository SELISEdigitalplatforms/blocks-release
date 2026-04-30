enum Version {
  V1 = "v1",
}

export const API_BASES = {
  COMMUNICATION: `/communication/${Version.V1}`,
  CLOUD_CONFIGURATION: `/cloudconfiguration/${Version.V1}`,
  UDS: `/uds/${Version.V1}`,
  UILM: `/uilm/${Version.V1}`,
  UTILITIES: `/utilities/${Version.V1}`,
  CLOUD_BUILD: `/cloudbuild/${Version.V1}`,
  IDP: `/idp/${Version.V1}`,
  IDENTIFIER: `/identifier/${Version.V1}`,
  LMT: `/lmt/${Version.V1}`,
  MFA: `/mfa/${Version.V1}`,
  ALERT: `/alert/${Version.V1}`,
  AI: `/blocksai-api/${Version.V1}`,
  STUDIO: `/studio/${Version.V1}`,
} as const;
