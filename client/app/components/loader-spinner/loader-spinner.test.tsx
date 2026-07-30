import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadingSpinner from "./loader-spinner";

describe("LoadingSpinner", () => {
  it("renders the default label", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders each variant and hides the label when empty", () => {
    const { rerender, container } = render(
      <LoadingSpinner variant="fullscreen" label="Please wait" />,
    );
    expect(screen.getByText("Please wait")).toBeInTheDocument();
    rerender(<LoadingSpinner variant="inline" label="" />);
    expect(container.querySelector("p")).toBeNull();
  });
});
