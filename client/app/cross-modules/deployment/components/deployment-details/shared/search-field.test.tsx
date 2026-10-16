import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SearchField } from "./search-field";

const renderField = (value = "") =>
  render(
    <SearchField value={value} label="Search dependencies" paddingTarget="input">
      <input placeholder="Search dependencies..." defaultValue={value} />
    </SearchField>,
  );

describe("SearchField", () => {
  it("starts collapsed to its icon button when empty", () => {
    renderField();
    const trigger = screen.getByRole("button", { name: "Search dependencies" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("stays open while it holds a value", () => {
    renderField("lodash");
    expect(screen.getByRole("button", { name: "Search dependencies" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("opens on click, focuses the input, and closes on Escape", async () => {
    const user = userEvent.setup();
    renderField();
    const trigger = screen.getByRole("button", { name: "Search dependencies" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByPlaceholderText("Search dependencies...")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
