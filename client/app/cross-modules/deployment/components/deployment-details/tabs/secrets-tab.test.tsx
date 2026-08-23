import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";

vi.mock("@blocks-deployment/components/repo-secrets/repo-secrets-panel", () => ({
  RepoSecretsPanel: ({ repoId }: { repoId: string }) => (
    <div data-testid="panel">{repoId}</div>
  ),
}));

import SecretsTab from "./secrets-tab";

describe("SecretsTab", () => {
  it("renders nothing until the repository id is known", () => {
    const { container } = renderWithProviders(<SecretsTab />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a skeleton while the panel chunk loads, then the panel", async () => {
    renderWithProviders(<SecretsTab repoId="r1" repoName="acme/api" />);

    // The panel is lazy, so the fallback is what paints first.
    expect(screen.getByTestId("secrets-tab-loading")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId("panel")).toHaveTextContent("r1"),
    );
  });
});
