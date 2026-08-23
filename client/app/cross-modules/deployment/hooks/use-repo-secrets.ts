import { repoSecretsService } from "@blocks-deployment/services/repo-secrets.service";
import type {
  IRepoSecretValue,
  RepoSecretMap,
} from "@blocks-deployment/models/repo-secrets.model";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Everything under this prefix is invalidated by any mutation. */
const REPO_SECRET_KEY = "repo-secret";

export const useRepoSecretMeta = (repoId: string) =>
  useQuery({
    queryKey: [REPO_SECRET_KEY, "meta", repoId],
    queryFn: () => repoSecretsService.getMeta(repoId),
    enabled: !!repoId,
  });

export const useRepoSecretAudit = (
  repoId: string,
  pageNumber: number,
  pageSize: number,
  enabled = true,
) =>
  useQuery({
    queryKey: [REPO_SECRET_KEY, "audit", repoId, pageNumber, pageSize],
    queryFn: () => repoSecretsService.getAudit(repoId, pageNumber, pageSize),
    enabled: enabled && !!repoId,
  });

/**
 * Reads the plaintext set.
 *
 * A mutation, not a query, on purpose: React Query would cache the value and could refetch it on
 * window focus or reconnect, turning one deliberate — and server-audited — read into several.
 * As a mutation it runs exactly once per user action and nothing plaintext enters the cache.
 */
export const useRevealRepoSecrets = () =>
  useMutation<IRepoSecretValue, unknown, string>({
    mutationKey: [REPO_SECRET_KEY, "reveal"],
    mutationFn: (repoId: string) => repoSecretsService.getValue(repoId),
  });

export const useSaveRepoSecrets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [REPO_SECRET_KEY, "save"],
    mutationFn: ({
      repoId,
      secrets,
    }: {
      repoId: string;
      secrets: RepoSecretMap;
    }) => repoSecretsService.save(repoId, secrets),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REPO_SECRET_KEY] });
    },
  });
};

/**
 * The four lifecycle transitions share one factory: each is the same call shape with a different
 * verb, and writing them out separately would be four chances to forget the invalidation.
 */
const useRepoSecretLifecycle = (
  action: "lock" | "unlock" | "delete" | "restore",
  mutationFn: (repoId: string) => Promise<void>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [REPO_SECRET_KEY, action],
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REPO_SECRET_KEY] });
    },
  });
};

export const useLockRepoSecrets = () =>
  useRepoSecretLifecycle("lock", (repoId) => repoSecretsService.lock(repoId));

export const useUnlockRepoSecrets = () =>
  useRepoSecretLifecycle("unlock", (repoId) =>
    repoSecretsService.unlock(repoId),
  );

export const useDeleteRepoSecrets = () =>
  useRepoSecretLifecycle("delete", (repoId) =>
    repoSecretsService.remove(repoId),
  );

export const useRestoreRepoSecrets = () =>
  useRepoSecretLifecycle("restore", (repoId) =>
    repoSecretsService.restore(repoId),
  );
