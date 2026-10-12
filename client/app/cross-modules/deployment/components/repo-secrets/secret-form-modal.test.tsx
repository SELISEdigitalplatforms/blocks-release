import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const saveButton = () => screen.getByRole("button", { name: /save variables/i });
const radio = (name: RegExp) => screen.getByRole("radio", { name });
const envBox = () => screen.getByRole("textbox", { name: /^env/i });
const jsonBox = () => screen.getByRole("textbox", { name: /json/i });

/** Env opens first, so the key/value tests start by switching to it. */
const openKeyValue = () => userEvent.click(radio(/key \/ value/i));

describe("SecretFormModal", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("submits the rows as a flat object", async () => {
    const save = mockSave();
    renderModal();
    await openKeyValue();

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
    await openKeyValue();

    await userEvent.click(screen.getByRole("button", { name: /add more/i }));

    expect(screen.getAllByPlaceholderText("API_KEY")).toHaveLength(2);
  });

  it("rejects an invalid key without calling the server", async () => {
    const save = mockSave();
    renderModal();
    await openKeyValue();

    await userEvent.type(screen.getByPlaceholderText("API_KEY"), "db-password");

    expect(
      await screen.findByText(/start with a letter or underscore/i),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("API_KEY")).toHaveAttribute("aria-invalid", "true");
    expect(saveButton()).toBeDisabled();
    await userEvent.click(saveButton());
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it("rejects a duplicated key", async () => {
    const save = mockSave();
    renderModal({ A: "1" });
    await openKeyValue();

    await userEvent.click(screen.getByRole("button", { name: /add more/i }));

    const keyInputs = screen.getAllByPlaceholderText("API_KEY");
    await userEvent.type(keyInputs[1], "A");

    expect(
      await screen.findByText(/each key may appear only once/i),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
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

  it("switches away from invalid JSON and keeps both tabs' content", async () => {
    mockSave();
    renderModal();

    await userEvent.click(radio(/paste json/i));
    fireEvent.change(jsonBox(), { target: { value: "not json" } });
    expect(await screen.findByText(/this is not valid json/i)).toBeInTheDocument();

    await userEvent.click(radio(/key \/ value/i));

    // The switch happens, converts nothing, and raises no toast. The rows are still the new
    // set's single blank row, which is itself invalid, so returning converts nothing either.
    expect(radio(/key \/ value/i)).toHaveAttribute("aria-checked", "true");
    expect(screen.getByPlaceholderText("API_KEY")).toHaveValue("");
    expect(showErrorToast).not.toHaveBeenCalled();

    await userEvent.click(radio(/paste json/i));

    expect(jsonBox()).toHaveValue("not json");
    expect(
      await screen.findByText(/this is not valid json/i),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("saves pasted JSON on a new set, where the rows are still blank", async () => {
    const save = mockSave();
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: /paste json/i }));

    // fireEvent.change rather than userEvent.type: "{" and "}" are control sequences in
    // userEvent's keyboard grammar, so typing raw JSON does not produce the text it looks like.
    fireEvent.change(screen.getByRole("textbox", { name: /json/i }), {
      target: { value: '{"API_KEY":"abc"}' },
    });
    await userEvent.click(screen.getByRole("button", { name: /save variables/i }));

    // The blank row the key/value editor starts with must not fail the JSON submit: its error
    // would land on a field this mode does not render, leaving Save looking inert.
    await waitFor(() =>
      expect(save.mutateAsync).toHaveBeenCalledWith({
        repoId: REPO_ID,
        secrets: { API_KEY: "abc" },
      }),
    );
  });

  it("saves pasted JSON when editing an existing set", async () => {
    const save = mockSave();
    renderModal({ EXISTING: "v" });

    await userEvent.click(screen.getByRole("radio", { name: /paste json/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /json/i }), {
      target: { value: '{"API_KEY":"abc"}' },
    });
    await userEvent.click(screen.getByRole("button", { name: /save variables/i }));

    await waitFor(() =>
      expect(save.mutateAsync).toHaveBeenCalledWith({
        repoId: REPO_ID,
        secrets: { API_KEY: "abc" },
      }),
    );
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

    expect(
      await screen.findByText('The value for "A" must be text in quotes.'),
    ).toBeInTheDocument();
    expect(jsonBox()).toHaveAttribute("aria-invalid", "true");
    expect(saveButton()).toBeDisabled();

    // Correcting it clears the message and enables Save on the same input, with no tab switch.
    fireEvent.change(jsonBox(), { target: { value: '{"A":"1"}' } });

    await waitFor(() => expect(screen.queryByText(/must be text in quotes/i)).toBeNull());
    expect(saveButton()).toBeEnabled();
    await userEvent.click(saveButton());
    await waitFor(() =>
      expect(save.mutateAsync).toHaveBeenCalledWith({
        repoId: REPO_ID,
        secrets: { A: "1" },
      }),
    );
  });

  it("opens an edit on Env, seeded from the current set, with Save enabled", () => {
    mockSave();
    renderModal({ API_KEY: "abc", DB: "x" });

    expect(radio(/^env$/i)).toHaveAttribute("aria-checked", "true");
    expect(envBox()).toHaveValue("API_KEY=abc\nDB=x");
    expect(saveButton()).toBeEnabled();
  });

  it("seeds the key/value editor from the current set when editing", async () => {
    mockSave();
    renderModal({ API_KEY: "abc", DB: "x" });
    await openKeyValue();

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
    await openKeyValue();

    await userEvent.type(screen.getByPlaceholderText("API_KEY"), "DB");
    await userEvent.type(screen.getByPlaceholderText("value"), "x");
    await userEvent.click(screen.getByRole("button", { name: /save variables/i }));

    expect(
      await screen.findByText("Secret key 'DB' is invalid."),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("DB")).toBeInTheDocument();
    expect(showErrorToast).not.toHaveBeenCalled();
    // The client rules still pass, so the user can retry.
    expect(saveButton()).toBeEnabled();
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
    await openKeyValue();

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

  it("disables every tab while saving", () => {
    mockSave({ isPending: true });
    renderModal({ API_KEY: "abc" });

    for (const tab of screen.getAllByRole("radio")) expect(tab).toBeDisabled();
  });

  it("lists Env, Key / value, Paste JSON in that order and opens on an empty Env", () => {
    mockSave();
    renderModal();

    expect(screen.getAllByRole("radio").map((tab) => tab.textContent)).toEqual([
      "Env",
      "Key / value",
      "Paste JSON",
    ]);
    expect(radio(/^env$/i)).toHaveAttribute("aria-checked", "true");
    expect(envBox()).toHaveValue("");
    expect(envBox()).toHaveAttribute("placeholder", "FEATURE_FLAG=enabled\nREGION=eu");
  });

  it("opens a new set with no message, Save disabled and Cancel enabled", () => {
    mockSave();
    renderModal();

    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeEnabled();
    expect(envBox()).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText(/paste .env-formatted text/i)).toBeNull();
  });

  it("shows no message on a tab the user has not edited, even when it is invalid", async () => {
    mockSave();
    renderModal();

    await openKeyValue();
    await userEvent.click(radio(/paste json/i));
    await userEvent.click(radio(/^env$/i));

    expect(screen.queryByText(/a key is required/i)).toBeNull();
    expect(screen.queryByText(/add at least one variable/i)).toBeNull();
    expect(screen.queryByText(/paste a json object/i)).toBeNull();
    expect(screen.queryByText(/paste .env-formatted text/i)).toBeNull();
    expect(saveButton()).toBeDisabled();
  });

  it("counts adding and removing a row as editing the key/value tab", async () => {
    mockSave();
    renderModal();
    await openKeyValue();

    await userEvent.click(screen.getByRole("button", { name: /add more/i }));
    expect(await screen.findByText("Add at least one variable.")).toBeInTheDocument();

    await userEvent.type(screen.getAllByPlaceholderText("API_KEY")[0], "A");
    await userEvent.click(screen.getByRole("button", { name: /remove variable 2/i }));

    await waitFor(() => expect(screen.queryByText("Add at least one variable.")).toBeNull());
    expect(screen.getAllByPlaceholderText("API_KEY")).toHaveLength(1);
    expect(saveButton()).toBeEnabled();
  });

  it("counts removing a row as an edit on its own", async () => {
    mockSave();
    // A stored key the client rules reject (e.g. saved before they existed): the key/value tab
    // is invalid but unedited, so it opens without a message.
    renderModal({ "1BAD": "x", GOOD: "y" });
    await openKeyValue();
    expect(screen.queryByText(/start with a letter or underscore/i)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /remove variable 2/i }));

    expect(await screen.findByText(/start with a letter or underscore/i)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("saves from key/value without the trailing blank row", async () => {
    const save = mockSave();
    renderModal();
    await openKeyValue();

    await userEvent.type(screen.getByPlaceholderText("API_KEY"), "API_KEY");
    await userEvent.type(screen.getByPlaceholderText("value"), "abc");
    await userEvent.click(screen.getByRole("button", { name: /add more/i }));
    await userEvent.click(saveButton());

    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalledTimes(1));
    expect(save.mutateAsync).toHaveBeenCalledWith({
      repoId: REPO_ID,
      secrets: { API_KEY: "abc" },
    });
  });

  it("routes a server key error onto the first row that was sent, not a blank row 0", async () => {
    mockSave({
      mutateAsync: vi.fn().mockRejectedValue({
        errors: {
          invalid_request: "Secret key 'DB' is invalid.",
          reason: "SECRET_KEY_INVALID",
        },
      }),
    });
    renderModal();
    await openKeyValue();

    await userEvent.click(screen.getByRole("button", { name: /add more/i }));
    const keys = screen.getAllByPlaceholderText("API_KEY");
    await userEvent.type(keys[1], "DB");
    await userEvent.click(saveButton());

    expect(await screen.findByText("Secret key 'DB' is invalid.")).toBeInTheDocument();
    expect(keys[1]).toHaveAttribute("aria-invalid", "true");
    expect(keys[0]).toHaveAttribute("aria-invalid", "false");
  });

  it("converts a valid tab into one left invalid, replacing its text (H5 over C2)", async () => {
    mockSave();
    renderModal();

    fireEvent.change(envBox(), { target: { value: "NOT_A_VARIABLE" } });
    await screen.findByText("Line 1: expected KEY=VALUE.");
    await openKeyValue();

    await userEvent.type(screen.getByPlaceholderText("API_KEY"), "API_KEY");
    await userEvent.type(screen.getByPlaceholderText("value"), "abc");
    await userEvent.click(radio(/^env$/i));

    // Key / value was valid, so its set is carried across and the invalid Env text is replaced.
    expect(envBox()).toHaveValue("API_KEY=abc");
    await waitFor(() => expect(screen.queryByText(/expected KEY=VALUE/i)).toBeNull());
    expect(saveButton()).toBeEnabled();
  });

  it("opens Paste JSON empty after a blank key/value tab, not as an empty key", async () => {
    mockSave();
    renderModal();

    await openKeyValue();
    await userEvent.click(radio(/paste json/i));

    expect(radio(/paste json/i)).toHaveAttribute("aria-checked", "true");
    expect(jsonBox()).toHaveValue("");
    expect(screen.queryByText(/key "":/i)).toBeNull();
    expect(saveButton()).toBeDisabled();
  });

  it("drops blank rows when carrying key/value into another tab", async () => {
    mockSave();
    renderModal();
    await openKeyValue();

    await userEvent.type(screen.getByPlaceholderText("API_KEY"), "API_KEY");
    await userEvent.type(screen.getByPlaceholderText("value"), "abc");
    await userEvent.click(screen.getByRole("button", { name: /add more/i }));

    // A trailing blank row is not an error and does not block the save.
    expect(saveButton()).toBeEnabled();

    await userEvent.click(radio(/^env$/i));
    expect(envBox()).toHaveValue("API_KEY=abc");

    await userEvent.click(radio(/paste json/i));
    expect(jsonBox()).toHaveValue('{\n  "API_KEY": "abc"\n}');
    expect(saveButton()).toBeEnabled();
  });

  it("switches away from an invalid key/value row without converting it", async () => {
    mockSave();
    renderModal();
    await openKeyValue();

    await userEvent.type(screen.getByPlaceholderText("API_KEY"), "1BAD");
    await userEvent.type(screen.getByPlaceholderText("value"), "x");
    expect(saveButton()).toBeDisabled();

    await userEvent.click(radio(/^env$/i));
    expect(envBox()).toHaveValue("");

    await openKeyValue();
    expect(screen.getByDisplayValue("1BAD")).toBeInTheDocument();
    expect(screen.getByDisplayValue("x")).toBeInTheDocument();
    expect(await screen.findByText(/start with a letter or underscore/i)).toBeInTheDocument();
  });

  it("keeps the size message and still switches tabs over the byte limit", async () => {
    mockSave();
    renderModal();

    // {"A":"<v>"} is 8 bytes of JSON around the value.
    fireEvent.change(envBox(), {
      target: { value: `A=${"x".repeat(25_601 - 8)}` },
    });

    expect(
      await screen.findByText("This set is 25601 bytes; the maximum is 25600."),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await userEvent.click(radio(/paste json/i));
    expect(radio(/paste json/i)).toHaveAttribute("aria-checked", "true");
    expect(jsonBox()).toHaveValue("");
  });

  it("switches tabs from the keyboard while the active tab is invalid", async () => {
    mockSave();
    renderModal();

    await userEvent.type(envBox(), "NOT_A_VARIABLE");
    await screen.findByText("Line 1: expected KEY=VALUE.");

    // Back out of the textarea with Shift+Tab: Paste JSON, Key / value, then Env.
    await userEvent.tab({ shift: true });
    expect(radio(/paste json/i)).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(radio(/key \/ value/i)).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(radio(/^env$/i)).toHaveFocus();

    // Each radio activates from the keyboard while the active tab is invalid.
    await userEvent.tab();
    expect(radio(/key \/ value/i)).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(radio(/key \/ value/i)).toHaveAttribute("aria-checked", "true");

    await userEvent.tab();
    expect(radio(/paste json/i)).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(radio(/paste json/i)).toHaveAttribute("aria-checked", "true");

    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    expect(radio(/^env$/i)).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(radio(/^env$/i)).toHaveAttribute("aria-checked", "true");
    expect(envBox()).toHaveValue("NOT_A_VARIABLE");
    expect(await screen.findByText("Line 1: expected KEY=VALUE.")).toBeInTheDocument();
  });

  it("makes no request when switching tabs or validating", async () => {
    const save = mockSave();
    // The app's HttpClient sends through fetch, so the spy sees any request made directly from
    // here. The save hook is mocked, so its mutateAsync is how a save attempt shows up. Neither
    // can see a request from code this test mocks out; the E2E run records the real network.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderModal();

    fireEvent.change(envBox(), { target: { value: "NOT_A_VARIABLE" } });
    await screen.findByText("Line 1: expected KEY=VALUE.");
    fireEvent.change(envBox(), { target: { value: "A=1" } });
    await openKeyValue();
    await userEvent.click(radio(/paste json/i));
    await userEvent.click(radio(/^env$/i));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it("opens on Env again when closed and reopened", async () => {
    mockSave();
    const onOpenChange = vi.fn();
    const { rerender } = renderWithProviders(
      <SecretFormModal open onOpenChange={onOpenChange} repoId={REPO_ID} />,
    );

    await openKeyValue();
    rerender(<SecretFormModal open={false} onOpenChange={onOpenChange} repoId={REPO_ID} />);
    rerender(<SecretFormModal open onOpenChange={onOpenChange} repoId={REPO_ID} />);

    expect(await screen.findByRole("radio", { name: /^env$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(envBox()).toHaveValue("");
  });

  it("discards invalid Env text and its message when closed and reopened", async () => {
    mockSave();
    const onOpenChange = vi.fn();
    const { rerender } = renderWithProviders(
      <SecretFormModal open onOpenChange={onOpenChange} repoId={REPO_ID} />,
    );

    fireEvent.change(envBox(), { target: { value: "NOT_A_VARIABLE" } });
    await screen.findByText("Line 1: expected KEY=VALUE.");

    rerender(<SecretFormModal open={false} onOpenChange={onOpenChange} repoId={REPO_ID} />);
    rerender(<SecretFormModal open onOpenChange={onOpenChange} repoId={REPO_ID} />);

    expect(await screen.findByRole("radio", { name: /^env$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(envBox()).toHaveValue("");
    expect(screen.queryByText(/expected KEY=VALUE/i)).toBeNull();
    expect(envBox()).toHaveAttribute("aria-invalid", "false");
  });

  it("saves pasted env text on a new set", async () => {
    const save = mockSave();
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: /^env$/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /^env/i }), {
      target: {
        value: "BLOCKS_APP_URL=\nBLOCKS_API_BASE_URL=https://api.blocks.cloud",
      },
    });
    await userEvent.click(screen.getByRole("button", { name: /save variables/i }));

    await waitFor(() =>
      expect(save.mutateAsync).toHaveBeenCalledWith({
        repoId: REPO_ID,
        secrets: {
          BLOCKS_APP_URL: "",
          BLOCKS_API_BASE_URL: "https://api.blocks.cloud",
        },
      }),
    );
  });

  it("carries env text into Key / value on a mode switch", async () => {
    mockSave();
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: /^env$/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /^env/i }), {
      target: { value: "API_KEY=abc" },
    });
    await userEvent.click(screen.getByRole("radio", { name: /key \/ value/i }));

    expect(screen.getByDisplayValue("API_KEY")).toBeInTheDocument();
    expect(screen.getByDisplayValue("abc")).toBeInTheDocument();
  });

  it("serializes rows into Env on a mode switch", async () => {
    mockSave();
    renderModal({ API_KEY: "abc" });

    await userEvent.click(screen.getByRole("radio", { name: /^env$/i }));

    expect(screen.getByRole("textbox", { name: /^env/i })).toHaveValue(
      "API_KEY=abc",
    );
  });

  it("rejects invalid env text without calling the server", async () => {
    const save = mockSave();
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: /^env$/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /^env/i }), {
      target: { value: "NOT_A_VARIABLE" },
    });

    expect(await screen.findByText("Line 1: expected KEY=VALUE.")).toBeInTheDocument();
    expect(envBox()).toHaveAttribute("aria-invalid", "true");
    expect(saveButton()).toBeDisabled();
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it("leaves an edit's key/value rows unchanged when switching from invalid Env", async () => {
    mockSave();
    renderModal({ API_KEY: "abc" });

    fireEvent.change(envBox(), { target: { value: "NOT_A_VARIABLE" } });
    await screen.findByText("Line 1: expected KEY=VALUE.");
    await openKeyValue();

    expect(screen.getByDisplayValue("API_KEY")).toBeInTheDocument();
    expect(screen.getByDisplayValue("abc")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("API_KEY")).toHaveLength(1);
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("leaves an edit's key/value rows unchanged when switching from invalid JSON", async () => {
    mockSave();
    renderModal({ API_KEY: "abc" });

    await userEvent.click(radio(/paste json/i));
    fireEvent.change(jsonBox(), { target: { value: "not json" } });
    await screen.findByText("This is not valid JSON.");
    await openKeyValue();

    expect(screen.getByDisplayValue("API_KEY")).toBeInTheDocument();
    expect(screen.getByDisplayValue("abc")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("API_KEY")).toHaveLength(1);
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("switches away from invalid Env and keeps both tabs' content", async () => {
    mockSave();
    renderModal();

    fireEvent.change(envBox(), { target: { value: "NOT_A_VARIABLE" } });
    await screen.findByText("Line 1: expected KEY=VALUE.");

    await openKeyValue();

    // Selected, rows untouched (the one blank row), and the Env message does not follow.
    expect(radio(/key \/ value/i)).toHaveAttribute("aria-checked", "true");
    expect(screen.getByPlaceholderText("API_KEY")).toHaveValue("");
    expect(screen.getByPlaceholderText("value")).toHaveValue("");
    expect(screen.queryByText(/expected KEY=VALUE/i)).toBeNull();
    expect(showErrorToast).not.toHaveBeenCalled();

    await userEvent.click(radio(/^env$/i));

    expect(envBox()).toHaveValue("NOT_A_VARIABLE");
    expect(await screen.findByText("Line 1: expected KEY=VALUE.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("routes a server key error onto the env field", async () => {
    mockSave({
      mutateAsync: vi.fn().mockRejectedValue({
        errors: {
          invalid_request: "Secret key 'DB' is invalid.",
          reason: "SECRET_KEY_INVALID",
        },
      }),
    });
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: /^env$/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /^env/i }), {
      target: { value: "DB=x" },
    });
    await userEvent.click(screen.getByRole("button", { name: /save variables/i }));

    expect(await screen.findByText("Secret key 'DB' is invalid.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^env/i })).toHaveValue(
      "DB=x",
    );
    expect(showErrorToast).not.toHaveBeenCalled();
  });

});
