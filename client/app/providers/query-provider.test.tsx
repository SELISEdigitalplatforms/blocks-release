import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import QueryProvider, { getQueryClient } from "./query-provider";

describe("QueryProvider", () => {
  it("renders its children", () => {
    render(
      <QueryProvider>
        <div>child</div>
      </QueryProvider>,
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("returns a stable singleton query client", () => {
    expect(getQueryClient()).toBe(getQueryClient());
  });
});
