import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ComingSoonPage from "./coming-soon";

describe("ComingSoonPage", () => {
  it("renders the message", () => {
    render(<ComingSoonPage message="Feature X" />);
    expect(screen.getByText("Feature X")).toBeInTheDocument();
    expect(
      screen.getByText(/working hard to bring something amazing/i),
    ).toBeInTheDocument();
  });
});
