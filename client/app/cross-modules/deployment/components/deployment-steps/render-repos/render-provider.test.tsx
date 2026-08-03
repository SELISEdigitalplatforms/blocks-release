import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useValidateAuthorization } from "@/cross-modules/deployment/hooks/use-github-info";
import { authenticateWithGithub } from "@blocks-deployment/services/providers.service";

const navigateMock = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("@/cross-modules/deployment/hooks/use-github-info", () => ({
  useValidateAuthorization: vi.fn(),
}));
vi.mock("@blocks-deployment/services/providers.service", () => ({
  authenticateWithGithub: vi.fn(),
  authenticateWithGitlab: vi.fn(),
  authenticateWithBitbucket: vi.fn(),
  authenticateWithAzure: vi.fn(),
  authenticateWithAws: vi.fn(),
}));

import ProviderButtons from "./render-provider";

describe("ProviderButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("navigates to the destination when already authorized and no onClose", () => {
    vi.mocked(useValidateAuthorization).mockReturnValue({
      data: { isSuccess: true },
    } as never);
    renderWithProviders(<ProviderButtons destination="/somewhere" />);
    fireEvent.click(screen.getByText("Continue with GitHub"));
    expect(navigateMock).toHaveBeenCalledWith("/somewhere");
  });

  it("calls onClose when authorized and a handler is provided", () => {
    const onClose = vi.fn();
    vi.mocked(useValidateAuthorization).mockReturnValue({
      data: { isSuccess: true },
    } as never);
    renderWithProviders(
      <ProviderButtons destination="/somewhere" onClose={onClose} />,
    );
    fireEvent.click(screen.getByText("Continue with GitHub"));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("starts GitHub auth when not yet authorized", () => {
    vi.mocked(useValidateAuthorization).mockReturnValue({
      data: { isSuccess: false },
    } as never);
    renderWithProviders(<ProviderButtons destination="/somewhere" />);
    fireEvent.click(screen.getByText("Continue with GitHub"));
    expect(authenticateWithGithub).toHaveBeenCalled();
    expect(localStorage.getItem("github_auth_destination")).toBe("/somewhere");
  });

  it("defaults the destination when none is provided", () => {
    vi.mocked(useValidateAuthorization).mockReturnValue({
      data: { isSuccess: true },
    } as never);
    renderWithProviders(<ProviderButtons destination="" />);
    expect(localStorage.getItem("destination")).toBe(
      "/app/deployment/configure",
    );
  });
});
