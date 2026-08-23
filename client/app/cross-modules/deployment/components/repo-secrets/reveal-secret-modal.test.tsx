import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { RevealSecretModal } from "./reveal-secret-modal";

const secrets = { API_KEY: "abc123", DB_PASSWORD: "p@ss", BLANK: "" };

const renderModal = (value = secrets) =>
  renderWithProviders(
    <RevealSecretModal open onOpenChange={vi.fn()} secrets={value} />,
  );

describe("RevealSecretModal", () => {
  it("opens on the key/value view with every pair readable", () => {
    renderModal();

    expect(screen.getByRole("radio", { name: "Key / value" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByDisplayValue("API_KEY")).toBeInTheDocument();
    expect(screen.getByDisplayValue("abc123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DB_PASSWORD")).toBeInTheDocument();
    expect(screen.getByDisplayValue("p@ss")).toBeInTheDocument();
  });

  it("is read-only — no add or remove controls", () => {
    renderModal();

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

  it("renders an empty stored value as a labelled placeholder rather than a blank box", () => {
    renderModal();

    expect(screen.getByLabelText("Value of BLANK")).toHaveAttribute(
      "placeholder",
      "(empty)",
    );
  });

  it("renders nothing but the shell when there are no secrets", () => {
    renderModal({});

    expect(screen.getByText("Environment variables")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("abc123")).toBeNull();
  });
});
