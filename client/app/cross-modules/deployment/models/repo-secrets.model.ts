/**
 * Client contract for a repository's secret set (`/api/RepoSecret`).
 *
 * Values live in Azure Key Vault; Mongo holds only metadata and the audit trail. No type here
 * carries plaintext except {@link IRepoSecretValue}, which is produced only by the dedicated,
 * server-audited value endpoint.
 */

/** Wire values. The backend compares these ordinally, so they are sent verbatim. */
export const REPO_SECRET_STATUS = {
  Active: "active",
  Locked: "locked",
  Deleted: "deleted",
} as const;

export type RepoSecretStatus =
  (typeof REPO_SECRET_STATUS)[keyof typeof REPO_SECRET_STATUS];

export const REPO_SECRET_STATUS_LABEL: Record<RepoSecretStatus, string> = {
  active: "Active",
  locked: "Locked",
  deleted: "Deleted",
};

/** A flat key/value set. The only shape the backend accepts. */
export type RepoSecretMap = Record<string, string>;

/**
 * Metadata view. Carries no key names by design — listing them would need a plaintext read,
 * and every plaintext read is audited.
 */
export interface IRepoSecretMeta {
  repoId: string;
  secretId: string | null;
  hasSecrets: boolean;
  name: string | null;
  description: string | null;
  status: RepoSecretStatus | null;
  createdDate: string | null;
  createdBy: string | null;
  lastUpdatedDate: string | null;
  lastUpdatedBy: string | null;
  lastRotatedDate: string | null;
  lastRotatedBy: string | null;
  rotationCount: number;
  deletedDate: string | null;
  deletedBy: string | null;
}

/** The only type here that holds plaintext. Never cached. */
export interface IRepoSecretValue {
  repoId: string;
  secretId: string;
  secrets: RepoSecretMap;
}

export interface IRepoSecretSaveResult {
  repoId: string;
  secretId: string;
  keyCount: number;
  /** True when the save created the secret, false when it replaced an existing one. */
  created: boolean;
}

export interface IRepoSecretAuditRow {
  auditId: string;
  secretId: string | null;
  secretName: string | null;
  action: string;
  outcome: string;
  reason: string | null;
  actorUserId: string;
  createdDate: string;
}

export interface IRepoSecretAuditPage {
  rows: IRepoSecretAuditRow[];
  totalCount: number;
}

/** The platform envelope every endpoint replies in. */
export interface IRepoSecretApiResponse<T> {
  isSuccess: boolean;
  statusCode?: number;
  message?: string;
  data: T;
}

/**
 * Reason codes the backend attaches to a 4xx. Only the ones a form can act on are named; every
 * other code falls through to a toast.
 */
export const REPO_SECRET_ERROR = {
  KeyInvalid: "SECRET_KEY_INVALID",
  ValueType: "SECRET_VALUE_TYPE",
  SecretsRequired: "SECRETS_REQUIRED",
  TooLarge: "SECRET_SET_TOO_LARGE",
  NoSecretForRepo: "NO_SECRET_FOR_REPO",
  VaultFailure: "VAULT_FAILURE",
} as const;

/**
 * Client mirror of the server's key rule. Duplicated deliberately so a typo is caught before a
 * round trip; the server re-validates and remains the authority.
 */
export const REPO_SECRET_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const REPO_SECRET_KEY_MAX_LENGTH = 128;

/** Key Vault caps a secret value at 25 KB; the whole serialized set shares that budget. */
export const REPO_SECRET_MAX_BYTES = 25 * 1024;
