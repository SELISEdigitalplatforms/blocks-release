import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RenderAlternatively, RenderConditionally } from "./index";

describe("RenderConditionally", () => {
  it("renders children when the condition is true", () => {
    render(
      <RenderConditionally condition={true}>
        <span>shown</span>
      </RenderConditionally>,
    );
    expect(screen.getByText("shown")).toBeInTheDocument();
  });

  it("renders nothing when the condition is false", () => {
    const { container } = render(
      <RenderConditionally condition={false}>
        <span>hidden</span>
      </RenderConditionally>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RenderAlternatively", () => {
  it("renders the first child when true", () => {
    render(
      <RenderAlternatively condition={true}>
        <span>yes</span>
        <span>no</span>
      </RenderAlternatively>,
    );
    expect(screen.getByText("yes")).toBeInTheDocument();
    expect(screen.queryByText("no")).not.toBeInTheDocument();
  });

  it("renders the second child when false", () => {
    render(
      <RenderAlternatively condition={false}>
        <span>yes</span>
        <span>no</span>
      </RenderAlternatively>,
    );
    expect(screen.getByText("no")).toBeInTheDocument();
  });
});
