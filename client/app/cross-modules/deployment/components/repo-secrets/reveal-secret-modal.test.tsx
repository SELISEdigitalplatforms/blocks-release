import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { RevealSecretModal } from "./reveal-secret-modal";

const secrets = { API_KEY: "abc123", DB_PASSWORD: "p@ss", BLANK: "" };

const renderModal = (value = secrets) =>
  renderWithProviders(
    <RevealSecretModal open onOpenChange={vi.fn()} secrets={value} />,
  );

const SECRETS_AS_ENV = "API_KEY=abc123\nDB_PASSWORD=p@ss\nBLANK=";

// The Copy all test replaces these; saved here so afterEach can put the originals back.
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalSecureContext = Object.getOwnPropertyDescriptor(window, "isSecureContext");

const restoreProperty = (
  target: object,
  key: string,
  descriptor: PropertyDescriptor | undefined,
) => {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
  } else {
    Reflect.deleteProperty(target, key);
  }
};

describe("RevealSecretModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    restoreProperty(navigator, "clipboard", originalClipboard);
    restoreProperty(window, "isSecureContext", originalSecureContext);
  });

  it("lists Env, Key / value, JSON in that order and opens on the Env view", () => {
    renderModal();

    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Env",
      "Key / value",
      "JSON",
    ]);
    expect(screen.getByRole("radio", { name: "Env" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("textbox", { name: /as env/i })).toHaveAttribute("readonly");
  });

  it("copies exactly the Env text with Copy all", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    renderModal();

    // The copy button is an unlabelled icon next to its "Copy all" caption.
    const copyAll = screen.getByText("Copy all").parentElement as HTMLElement;
    fireEvent.click(within(copyAll).getByRole("button"));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRETS_AS_ENV));
  });

  it("switches among the views from the passed-in set without a request", async () => {
    // The app's HttpClient sends through fetch, so the spy sees any request made from here. The
    // single audited reveal is the panel's, outside this component; the E2E run checks that.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: "Key / value" }));
    expect(screen.getByDisplayValue("abc123")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "JSON" }));
    expect(screen.getByRole("textbox", { name: /as json/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Env" }));
    expect(screen.getByRole("textbox", { name: /as env/i })).toHaveValue(SECRETS_AS_ENV);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows every pair readable on the key/value view", async () => {
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: "Key / value" }));

    expect(screen.getByDisplayValue("API_KEY")).toBeInTheDocument();
    expect(screen.getByDisplayValue("abc123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DB_PASSWORD")).toBeInTheDocument();
    expect(screen.getByDisplayValue("p@ss")).toBeInTheDocument();
  });

  it("is read-only — no add or remove controls", async () => {
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: "Key / value" }));

    expect(screen.queryByRole("button", { name: /add more/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
    expect(screen.getByDisplayValue("API_KEY")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("abc123")).toHaveAttribute("readonly");
  });

  it("switches to the whole object as JSON", async () => {
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: "JSON" }));

    expect(screen.getByRole("textbox", { name: /environment variables as json/i })).toHaveValue(
      JSON.stringify(secrets, null, 2),
    );
    // The pair inputs are gone; JSON is the whole view.
    expect(screen.queryByDisplayValue("API_KEY")).toBeNull();
  });

  it("renders an empty stored value as a labelled placeholder rather than a blank box", async () => {
    renderModal();

    await userEvent.click(screen.getByRole("radio", { name: "Key / value" }));

    expect(screen.getByLabelText("Value of BLANK")).toHaveAttribute(
      "placeholder",
      "(empty)",
    );
  });

  it("renders nothing but the shell when there are no secrets", async () => {
    renderModal({});

    expect(screen.getByText("Environment variables")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /as env/i })).toHaveValue("");

    await userEvent.click(screen.getByRole("radio", { name: "Key / value" }));
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);

    await userEvent.click(screen.getByRole("radio", { name: "JSON" }));
    expect(screen.getByRole("textbox", { name: /as json/i })).toHaveValue("{}");
  });

  it("opens on Env again after being closed and reopened", async () => {
    const { rerender } = renderModal();

    await userEvent.click(screen.getByRole("radio", { name: "JSON" }));
    rerender(<RevealSecretModal open={false} onOpenChange={vi.fn()} secrets={secrets} />);
    rerender(<RevealSecretModal open onOpenChange={vi.fn()} secrets={secrets} />);

    expect(await screen.findByRole("radio", { name: "Env" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
