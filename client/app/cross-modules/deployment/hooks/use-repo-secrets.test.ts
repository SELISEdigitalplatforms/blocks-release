import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { repoSecretsService } from "@blocks-deployment/services/repo-secrets.service";
import {
  useDeleteRepoSecrets,
  useRepoSecretAudit,
  useRepoSecretMeta,
  useRevealRepoSecrets,
  useSaveRepoSecrets,
} from "./use-repo-secrets";

vi.mock("@blocks-deployment/services/repo-secrets.service", () => ({
  repoSecretsService: {
    save: vi.fn(),
    getMeta: vi.fn(),
    getValue: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
    getAudit: vi.fn(),
  },
}));

const REPO_ID = "repo-1";

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

describe("use-repo-secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  it("keys the metadata query on the repository id", async () => {
    vi.mocked(repoSecretsService.getMeta).mockResolvedValue({
      hasSecrets: false,
    } as never);

    const { result } = renderHook(() => useRepoSecretMeta(REPO_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      queryClient.getQueryData(["repo-secret", "meta", REPO_ID]),
    ).toBeDefined();
  });

  it("does not fire the metadata query without a repository id", () => {
    renderHook(() => useRepoSecretMeta(""), { wrapper });

    expect(repoSecretsService.getMeta).not.toHaveBeenCalled();
  });

  it("does not fire the audit query while the modal is closed", () => {
    renderHook(() => useRepoSecretAudit(REPO_ID, 1, 10, false), { wrapper });

    expect(repoSecretsService.getAudit).not.toHaveBeenCalled();
  });

  it("keys the audit query on the page and size", async () => {
    vi.mocked(repoSecretsService.getAudit).mockResolvedValue({
      rows: [],
      totalCount: 0,
    });

    const { result } = renderHook(
      () => useRepoSecretAudit(REPO_ID, 2, 10, true),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      queryClient.getQueryData(["repo-secret", "audit", REPO_ID, 2, 10]),
    ).toBeDefined();
  });

  it("invalidates the whole repo-secret prefix after a save", async () => {
    vi.mocked(repoSecretsService.save).mockResolvedValue({
      repoId: REPO_ID,
      secretId: "s1",
      keyCount: 1,
      created: true,
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSaveRepoSecrets(), { wrapper });
    await result.current.mutateAsync({ repoId: REPO_ID, secrets: { A: "1" } });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["repo-secret"] });
  });

  it("invalidates the whole repo-secret prefix after a lifecycle change", async () => {
    vi.mocked(repoSecretsService.remove).mockResolvedValue(undefined);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteRepoSecrets(), { wrapper });
    await result.current.mutateAsync(REPO_ID);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["repo-secret"] });
  });

  /**
   * The reveal must stay a mutation: as a query React Query would cache the plaintext and could
   * refetch it on focus or reconnect, multiplying an audited read.
   */
  it("never caches the revealed plaintext", async () => {
    vi.mocked(repoSecretsService.getValue).mockResolvedValue({
      repoId: REPO_ID,
      secretId: "s1",
      secrets: { A: "1" },
    });

    const { result } = renderHook(() => useRevealRepoSecrets(), { wrapper });
    await result.current.mutateAsync(REPO_ID);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
