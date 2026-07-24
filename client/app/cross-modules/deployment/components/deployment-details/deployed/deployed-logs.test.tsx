import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeployedLogs from "./deployed-logs";

vi.mock("@blocks-deployment/services/deployed-logs.service", () => ({
  DeployedLogsService: class {
    getDeployedLogs = vi.fn().mockResolvedValue({ data: { steps: [] } });
  },
}));

const cardData = { status: "Succeeded", logs: [] } as never;

describe("DeployedLogs", () => {
  it("renders the loading state", () => {
    const { container } = render(<DeployedLogs buildId="b1" isLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders the success state", () => {
    const { container } = render(
      <DeployedLogs buildId="b1" isSuccess cardData={cardData} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders the error state", () => {
    const { container } = render(<DeployedLogs buildId="b1" isError />);
    expect(container).toBeTruthy();
  });
});
