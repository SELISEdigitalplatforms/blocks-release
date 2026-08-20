import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { REPO_SECRET_ENDPOINTS } from "@blocks-deployment/constants/endpoint.constant";
import { repoSecretsService } from "./repo-secrets.service";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

const REPO_ID = "repo 1/with slash";
const ENCODED = encodeURIComponent(REPO_ID);

describe("RepoSecretsService", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.post).mockReset();
    vi.mocked(http.delete).mockReset();
  });

  it("posts the whole set on save and unwraps the envelope", async () => {
    const data = { repoId: REPO_ID, secretId: "s1", keyCount: 2, created: true };
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true, data });

    const result = await repoSecretsService.save(REPO_ID, { A: "1", B: "2" });

    expect(http.post).toHaveBeenCalledWith(REPO_SECRET_ENDPOINTS.SAVE, {
      repoId: REPO_ID,
      secrets: { A: "1", B: "2" },
    });
    expect(result).toEqual(data);
  });

  it("encodes the repository id on the metadata read", async () => {
    vi.mocked(http.get).mockResolvedValue({ isSuccess: true, data: {} });

    await repoSecretsService.getMeta(REPO_ID);

    expect(http.get).toHaveBeenCalledWith(
      `${REPO_SECRET_ENDPOINTS.GET}?repoId=${ENCODED}`,
    );
  });

  it("encodes the repository id on the value read", async () => {
    vi.mocked(http.get).mockResolvedValue({ isSuccess: true, data: {} });

    await repoSecretsService.getValue(REPO_ID);

    expect(http.get).toHaveBeenCalledWith(
      `${REPO_SECRET_ENDPOINTS.VALUE}?repoId=${ENCODED}`,
    );
  });

  it.each([
    ["lock", REPO_SECRET_ENDPOINTS.LOCK],
    ["unlock", REPO_SECRET_ENDPOINTS.UNLOCK],
    ["restore", REPO_SECRET_ENDPOINTS.RESTORE],
  ] as const)("posts the repository id for %s", async (method, endpoint) => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true });

    await repoSecretsService[method](REPO_ID);

    expect(http.post).toHaveBeenCalledWith(endpoint, { repoId: REPO_ID });
  });

  it("encodes the repository id on delete", async () => {
    vi.mocked(http.delete).mockResolvedValue({ isSuccess: true });

    await repoSecretsService.remove(REPO_ID);

    expect(http.delete).toHaveBeenCalledWith(
      `${REPO_SECRET_ENDPOINTS.DELETE}?repoId=${ENCODED}`,
    );
  });

  it("flattens the audit page", async () => {
    vi.mocked(http.get).mockResolvedValue({
      isSuccess: true,
      data: { data: [{ auditId: "a1" }], totalCount: 12 },
    });

    const result = await repoSecretsService.getAudit(REPO_ID, 2, 10);

    expect(http.get).toHaveBeenCalledWith(
      `${REPO_SECRET_ENDPOINTS.AUDIT}?repoId=${ENCODED}&pageNumber=2&pageSize=10`,
    );
    expect(result).toEqual({ rows: [{ auditId: "a1" }], totalCount: 12 });
  });

  it("returns an empty audit page when the payload is missing", async () => {
    vi.mocked(http.get).mockResolvedValue({ isSuccess: true, data: null });

    expect(await repoSecretsService.getAudit(REPO_ID, 1, 10)).toEqual({
      rows: [],
      totalCount: 0,
    });
  });
});
