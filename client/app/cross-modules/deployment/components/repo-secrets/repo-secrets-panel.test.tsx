import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useDeleteRepoSecrets,
  useLockRepoSecrets,
  useRepoSecretAudit,
  useRepoSecretMeta,
  useRestoreRepoSecrets,
  useRevealRepoSecrets,
  useSaveRepoSecrets,
  useUnlockRepoSecrets,
} from "@blocks-deployment/hooks/use-repo-secrets";

vi.mock("@blocks-deployment/hooks/use-repo-secrets", () => ({
  useRepoSecretMeta: vi.fn(),
  useRepoSecretAudit: vi.fn(),
  useRevealRepoSecrets: vi.fn(),
  useSaveRepoSecrets: vi.fn(),
  useLockRepoSecrets: vi.fn(),
  useUnlockRepoSecrets: vi.fn(),
  useDeleteRepoSecrets: vi.fn(),
  useRestoreRepoSecrets: vi.fn(),
}));

import { RepoSecretsPanel } from "./repo-secrets-panel";

const REPO_ID = "repo-1";

const idleMutation = () =>
  ({ mutateAsync: vi.fn(), isPending: false }) as never;

const meta = (overrides: Record<string, unknown> = {}) =>
  ({
    data: {
      repoId: REPO_ID,
      secretId: "s1",
      hasSecrets: true,
      status: "active",
      rotationCount: 1,
      lastRotatedDate: "2026-08-01T10:00:00Z",
      ...overrides,
    },
    isLoading: false,
    isFetching: false,
    error: null,
  }) as never;

const renderPanel = () =>
  renderWithProviders(<RepoSecretsPanel repoId={REPO_ID} repoName="acme/api" />);

describe("RepoSecretsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // The audit and form modals mount with the panel even while closed, so their hooks need a
    // shape from the first render.
    vi.mocked(useRepoSecretAudit).mockReturnValue({
      data: { rows: [], totalCount: 0 },
      isLoading: false,
    } as never);
    vi.mocked(useSaveRepoSecrets).mockReturnValue(idleMutation());
    vi.mocked(useRevealRepoSecrets).mockReturnValue(idleMutation());
    vi.mocked(useLockRepoSecrets).mockReturnValue(idleMutation());
    vi.mocked(useUnlockRepoSecrets).mockReturnValue(idleMutation());
    vi.mocked(useDeleteRepoSecrets).mockReturnValue(idleMutation());
    vi.mocked(useRestoreRepoSecrets).mockReturnValue(idleMutation());
  });

  it("renders the skeleton on first load", () => {
    vi.mocked(useRepoSecretMeta).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      error: null,
    } as never);

    renderPanel();

    expect(screen.getByTestId("repo-secrets-loading")).toBeInTheDocument();
  });

  it("renders the empty state and never asks for a value", () => {
    const reveal = idleMutation();
    vi.mocked(useRevealRepoSecrets).mockReturnValue(reveal);
    vi.mocked(useRepoSecretMeta).mockReturnValue(
      meta({ hasSecrets: false, secretId: null, status: null }),
    );

    renderPanel();

    expect(screen.getByText("No environment variables yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add variables" }),
    ).toBeInTheDocument();
    expect(reveal.mutateAsync).not.toHaveBeenCalled();
  });

  it("renders a permission message when the request is refused", () => {
    vi.mocked(useRepoSecretMeta).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: { errors: { access_denied: "no", reason: "FORBIDDEN" } },
    } as never);

    renderPanel();

    expect(
      screen.getByText(/do not have permission to manage environment variables/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reveal/i })).toBeNull();
  });

  it("shows the lifecycle actions for an active secret", () => {
    vi.mocked(useRepoSecretMeta).mockReturnValue(meta());

    renderPanel();

    expect(screen.getByRole("button", { name: /reveal/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /edit/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^lock/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("disables reveal and edit while the secret is locked", () => {
    vi.mocked(useRepoSecretMeta).mockReturnValue(meta({ status: "locked" }));

    renderPanel();

    expect(screen.getByRole("button", { name: /reveal/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /edit/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /unlock/i })).toBeEnabled();
  });

  it("offers only restore once the secret is deleted", () => {
    vi.mocked(useRepoSecretMeta).mockReturnValue(
      meta({ status: "deleted", deletedDate: "2026-08-02T10:00:00Z" }),
    );

    renderPanel();

    expect(screen.getByRole("button", { name: /restore/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /reveal/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^lock/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("fetches the value once per reveal click and shows it", async () => {
    const reveal = {
      mutateAsync: vi.fn().mockResolvedValue({
        repoId: REPO_ID,
        secretId: "s1",
        secrets: { API_KEY: "abc123" },
      }),
      isPending: false,
    } as never;
    vi.mocked(useRevealRepoSecrets).mockReturnValue(reveal);
    vi.mocked(useRepoSecretMeta).mockReturnValue(meta());

    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /reveal/i }));

    await waitFor(() =>
      expect(screen.getByDisplayValue("abc123")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("API_KEY")).toBeInTheDocument();
    expect(reveal.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("dims the panel during a refetch instead of showing the skeleton", () => {
    vi.mocked(useRepoSecretMeta).mockReturnValue({
      ...meta(),
      isFetching: true,
    } as never);

    renderPanel();

    expect(screen.queryByTestId("repo-secrets-loading")).toBeNull();
    expect(screen.getByRole("button", { name: /reveal/i })).toBeDisabled();
  });
});
