import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useSaveRepoSecrets } from "@blocks-deployment/hooks/use-repo-secrets";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";

vi.mock("@blocks-deployment/hooks/use-repo-secrets", () => ({
  useSaveRepoSecrets: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

import { SecretFormModal } from "./secret-form-modal";

const REPO_ID = "repo-1";

const mockSave = (
  overrides: Partial<{ mutateAsync: unknown; isPending: boolean }> = {},
) => {
  const mutateAsync = vi.fn().mockResolvedValue({
    repoId: REPO_ID,
    secretId: "s1",
    keyCount: 1,
    created: true,
  });
  const value = { mutateAsync, isPending: false, ...overrides };

  vi.mocked(useSaveRepoSecrets).mockReturnValue(value as never);

  return value as { mutateAsync: ReturnType<typeof vi.fn> };
};

const renderModal = (initialSecrets?: Record<string, string>) =>
  renderWithProviders(
    <SecretFormModal
      open
      onOpenChange={vi.fn()}
      repoId={REPO_ID}
      initialSecrets={initialSecrets}
    />,
  );

describe("SecretFormModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits the rows as a flat object", async () => {
    const save = mockSave();
    renderModal();

    await userEvent.type(screen.getByPlaceholderText("API_KEY"), "DB_PASSWORD");
    await userEvent.type(screen.getByPlaceholderText("value"), "p@ss");
    await userEvent.click(screen.getByRole("button", { name: /save variables/i }));

    await waitFor(() =>
      expect(save.mutateAsync).toHaveBeenCalledWith({
        repoId: REPO_ID,
        secrets: { DB_PASSWORD: "p@ss" },
      }),
    );
    expect(showSuccessToast).toHaveBeenCalledWith({
      description: "Environment variables saved successfully",
    });
  });

  it("adds another row on Add more", async () => {
    mockSave();
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: /add more/i }));

    expect(screen.getAllByPlaceholderText("API_KEY")).toHaveLength(2);
  });

  it("rejects an invalid key without calling the server", async () => {
    const save = mockSave();
    renderModal();

    await userEvent.type(screen.getByPlaceholderText("API_KEY"), "db-password");
    await userEvent.click(screen.getByRole("button", { name: /save variables/i }));

    expect(
      await screen.findByText(/start with a letter or underscore/i),
    ).toBeInTheDocument();
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it("rejects a duplicated key", async () => {
    const save = mockSave();
    renderModal({ A: "1" });

    await userEvent.click(screen.getByRole("button", { name: /add more/i }));

    const keyInputs = screen.getAllByPlaceholderText("API_KEY");
    await userEvent.type(keyInputs[1], "A");
    await userEvent.click(screen.getByRole("button", { name: /save variables/i }));

    expect(
      await screen.findByText(/each key may appear only once/i),
    ).toBeInTheDocument();
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it("carries rows into the JSON editor on a mode switch", async () => {
    mockSave();
    renderModal({ API_KEY: "abc" });

    await userEvent.click(screen.getByRole("radio", { name: /paste json/i }));

    expect(screen.getByRole("textbox", { name: /json/i })).toHaveValue(
      '{\n  "API_KEY": "abc"\n}',
    );
  });

  it("refuses to leave JSON mode while the text does not parse", async () => {
    mockSave();
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: /paste json/i }));
    await userEvent.type(
      screen.getByRole("textbox", { name: /json/i }),
      "not json",
    );
    await userEvent.click(screen.getByRole("radio", { name: /key \/ value/i }));

    expect(
      await screen.findByText(/this is not valid json/i),
    ).toBeInTheDocument();
    // Still in JSON mode — the textarea is the proof.
    expect(screen.getByRole("textbox", { name: /json/i })).toBeInTheDocument();
  });

  it("rejects a non-string JSON value", async () => {
    const save = mockSave();
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: /paste json/i }));

    // fireEvent.change rather than userEvent.type: "{" and "}" are control sequences in
    // userEvent's keyboard grammar, so typing raw JSON does not produce the text it looks like.
    fireEvent.change(screen.getByRole("textbox", { name: /json/i }), {
      target: { value: '{"A":1}' },
    });
    await userEvent.click(screen.getByRole("button", { name: /save variables/i }));

    expect(
      await screen.findByText(/must be text in quotes/i),
    ).toBeInTheDocument();
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it("seeds the editor from the current set when editing", () => {
    mockSave();
    renderModal({ API_KEY: "abc", DB: "x" });

    expect(screen.getByDisplayValue("API_KEY")).toBeInTheDocument();
    expect(screen.getByDisplayValue("abc")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DB")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /edit environment variables/i })).toBeInTheDocument();
  });

  it("routes a server key error back onto the field and keeps the input", async () => {
    mockSave({
      mutateAsync: vi.fn().mockRejectedValue({
        errors: {
          invalid_request: "Secret key 'DB' is invalid.",
          reason: "SECRET_KEY_INVALID",
        },
      }),
    });
    renderModal();

    await userEvent.type(screen.getByPlaceholderText("API_KEY"), "DB");
    await userEvent.type(screen.getByPlaceholderText("value"), "x");
    await userEvent.click(screen.getByRole("button", { name: /save variables/i }));

    expect(
      await screen.findByText("Secret key 'DB' is invalid."),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("DB")).toBeInTheDocument();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("shows a vault failure in a form-level banner", async () => {
    mockSave({
      mutateAsync: vi.fn().mockRejectedValue({
        errors: {
          vault_unavailable: "The secret store is currently unavailable.",
          reason: "VAULT_FAILURE",
        },
      }),
    });
    renderModal();

    await userEvent.type(screen.getByPlaceholderText("API_KEY"), "DB");
    await userEvent.click(screen.getByRole("button", { name: /save variables/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The secret store is currently unavailable.",
    );
  });

  it("disables both buttons and shows the pending label while saving", () => {
    mockSave({ isPending: true });
    renderModal();

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });
});
