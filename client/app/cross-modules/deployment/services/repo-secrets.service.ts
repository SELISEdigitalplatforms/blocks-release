import { serviceInstances } from "@/lib/http-client";
import { REPO_SECRET_ENDPOINTS } from "@blocks-deployment/constants/endpoint.constant";
import type {
  IRepoSecretApiResponse,
  IRepoSecretAuditPage,
  IRepoSecretAuditRow,
  IRepoSecretMeta,
  IRepoSecretSaveResult,
  IRepoSecretValue,
  RepoSecretMap,
} from "@blocks-deployment/models/repo-secrets.model";

/** Server-side audit page shape, before it is flattened for the UI. */
interface IAuditListResult {
  data: IRepoSecretAuditRow[];
  totalCount: number;
}

/**
 * Talks to `/api/RepoSecret`. No React, no state, no toasts.
 *
 * Every method is keyed on a repository id — the API deliberately exposes no secret-id
 * addressing, so there is nothing here that could reach another repository's secret.
 */
export class RepoSecretsService {
  private readonly httpClient = serviceInstances.deploymentService;

  /** Creates or replaces the whole set. There is no partial update. */
  async save(
    repoId: string,
    secrets: RepoSecretMap,
  ): Promise<IRepoSecretSaveResult> {
    const response = await this.httpClient.post<
      IRepoSecretApiResponse<IRepoSecretSaveResult>
    >(REPO_SECRET_ENDPOINTS.SAVE, { repoId, secrets });

    return response.data;
  }

  async getMeta(repoId: string): Promise<IRepoSecretMeta> {
    const url = `${REPO_SECRET_ENDPOINTS.GET}?repoId=${encodeURIComponent(repoId)}`;
    const response =
      await this.httpClient.get<IRepoSecretApiResponse<IRepoSecretMeta>>(url);

    return response.data;
  }

  /**
   * Reads the plaintext set. Audited server-side on every call, so call it once per deliberate
   * user action — never speculatively on render.
   */
  async getValue(repoId: string): Promise<IRepoSecretValue> {
    const url = `${REPO_SECRET_ENDPOINTS.VALUE}?repoId=${encodeURIComponent(repoId)}`;
    const response =
      await this.httpClient.get<IRepoSecretApiResponse<IRepoSecretValue>>(url);

    return response.data;
  }

  async lock(repoId: string): Promise<void> {
    await this.httpClient.post(REPO_SECRET_ENDPOINTS.LOCK, { repoId });
  }

  async unlock(repoId: string): Promise<void> {
    await this.httpClient.post(REPO_SECRET_ENDPOINTS.UNLOCK, { repoId });
  }

  /** Soft delete — the vault value is retained so {@link restore} can bring it back. */
  async remove(repoId: string): Promise<void> {
    const url = `${REPO_SECRET_ENDPOINTS.DELETE}?repoId=${encodeURIComponent(repoId)}`;
    await this.httpClient.delete(url);
  }

  async restore(repoId: string): Promise<void> {
    await this.httpClient.post(REPO_SECRET_ENDPOINTS.RESTORE, { repoId });
  }

  async getAudit(
    repoId: string,
    pageNumber: number,
    pageSize: number,
  ): Promise<IRepoSecretAuditPage> {
    const url =
      `${REPO_SECRET_ENDPOINTS.AUDIT}?repoId=${encodeURIComponent(repoId)}` +
      `&pageNumber=${pageNumber}&pageSize=${pageSize}`;

    const response =
      await this.httpClient.get<IRepoSecretApiResponse<IAuditListResult>>(url);

    // Flattened here rather than in the hook so the component consumes one shape and a refetch
    // does not re-run the transform.
    return {
      rows: response.data?.data ?? [],
      totalCount: response.data?.totalCount ?? 0,
    };
  }
}

export const repoSecretsService = new RepoSecretsService();
