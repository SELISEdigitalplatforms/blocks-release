import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import DASTTab from "./dast-tab";

describe("DASTTab", () => {
  it("renders the metrics overview and vulnerabilities", () => {
    renderWithProviders(<DASTTab />, { nuqs: true });
    expect(screen.getByText("Overview of metrics")).toBeInTheDocument();
    expect(screen.getByText("View in DefectDojo")).toBeInTheDocument();
    expect(screen.getByText("SQL Injection")).toBeInTheDocument();
  });
});
