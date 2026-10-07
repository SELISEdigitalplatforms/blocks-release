import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useValidateAuthorization } from "@/cross-modules/deployment/hooks/use-github-info";
import {
  authenticateWithAws,
  authenticateWithAzure,
  authenticateWithBitbucket,
  authenticateWithGithub,
  authenticateWithGitlab,
} from "@blocks-deployment/services/providers.service";
import { useProjectStore } from "@/store/project.store";

const navigateMock = vi.fn();

type TestProvider = { id: string; name: string; icon: string; active: boolean };

// Lets a test swap in its own provider list (e.g. to enable the providers that
// ship disabled) while every other test keeps the real one.
const providerState = vi.hoisted(() => ({
  override: null as TestProvider[] | null,
}));

vi.mock("@blocks-deployment/models/git-dummy", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@blocks-deployment/models/git-dummy")>();
  return {
    ...actual,
    get providers() {
      return providerState.override ?? actual.providers;
    },
  };
});

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

  describe("additional branches", () => {
    const originalProject = useProjectStore.getState().selectedProject;

    afterEach(() => {
      // Unmount before resetting the shared store so the reset does not
      // re-render a still-mounted component outside act().
      cleanup();
      providerState.override = null;
      useProjectStore.setState({ selectedProject: originalProject });
      // Fire a matching reload event so any listener a test registered is
      // removed before the next test runs.
      window.dispatchEvent(
        new StorageEvent("storage", { key: "isReload", newValue: "true" }),
      );
      vi.restoreAllMocks();
    });

    const unauthorized = () =>
      vi.mocked(useValidateAuthorization).mockReturnValue({
        data: { isSuccess: false },
      } as never);

    it("renders every provider and only enables GitHub by default", () => {
      unauthorized();
      renderWithProviders(<ProviderButtons destination="/x" />);
      expect(
        screen.getByRole("button", { name: /Continue with GitHub/ }),
      ).toBeEnabled();
      ["GitLab", "Bitbucket", "Azure", "AWS"].forEach((name) => {
        expect(
          screen.getByRole("button", {
            name: new RegExp(`Continue with ${name}`),
          }),
        ).toBeDisabled();
      });
      expect(screen.getByAltText("GitHub icon")).toBeInTheDocument();
    });

    it("defaults the destination when the prop is omitted and navigates there", () => {
      vi.mocked(useValidateAuthorization).mockReturnValue({
        data: { isSuccess: true },
      } as never);
      renderWithProviders(<ProviderButtons destination={undefined as never} />);
      expect(localStorage.getItem("destination")).toBe(
        "/app/deployment/configure",
      );
      fireEvent.click(screen.getByText("Continue with GitHub"));
      expect(navigateMock).toHaveBeenCalledWith("/app/deployment/configure");
    });

    it("treats missing authorization data as unauthorized", () => {
      vi.mocked(useValidateAuthorization).mockReturnValue({
        data: undefined,
      } as never);
      renderWithProviders(<ProviderButtons destination="/x" />);
      fireEvent.click(screen.getByText("Continue with GitHub"));
      expect(authenticateWithGithub).toHaveBeenCalledWith("");
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it("logs and aborts GitHub auth when no project is selected", () => {
      unauthorized();
      useProjectStore.setState({ selectedProject: null });
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const onClose = vi.fn();
      renderWithProviders(
        <ProviderButtons
          destination="/x"
          onClose={onClose}
          closeOnProviderSelect
        />,
      );
      fireEvent.click(screen.getByText("Continue with GitHub"));
      expect(errorSpy).toHaveBeenCalledWith(
        "Missing project key for GitHub authorization.",
      );
      expect(authenticateWithGithub).not.toHaveBeenCalled();
      expect(localStorage.getItem("github_auth_project_key")).toBeNull();
      // The early return also skips the closeOnProviderSelect handler.
      expect(onClose).not.toHaveBeenCalled();
    });

    it("stores the project key and forwards extraState to GitHub auth", () => {
      unauthorized();
      renderWithProviders(
        <ProviderButtons destination="/x" extraState="repo-modal" />,
      );
      fireEvent.click(screen.getByText("Continue with GitHub"));
      expect(authenticateWithGithub).toHaveBeenCalledWith("repo-modal");
      expect(localStorage.getItem("github_auth_project_key")).toBe(
        "test-tenant-id-123",
      );
    });

    it("closes once the auth popup reports a reload through storage", () => {
      unauthorized();
      const onClose = vi.fn();
      renderWithProviders(
        <ProviderButtons destination="/x" onClose={onClose} />,
      );
      fireEvent.click(screen.getByText("Continue with GitHub"));
      expect(onClose).not.toHaveBeenCalled();

      // Unrelated storage events are ignored.
      window.dispatchEvent(
        new StorageEvent("storage", { key: "other", newValue: "true" }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: "isReload", newValue: "false" }),
      );
      expect(onClose).not.toHaveBeenCalled();

      localStorage.setItem("isReload", "true");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "isReload", newValue: "true" }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith(true);
      expect(localStorage.getItem("isReload")).toBe("false");

      // The listener removes itself after the first reload.
      window.dispatchEvent(
        new StorageEvent("storage", { key: "isReload", newValue: "true" }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("resets the reload flag even when no onClose handler is given", () => {
      unauthorized();
      renderWithProviders(<ProviderButtons destination="/x" />);
      fireEvent.click(screen.getByText("Continue with GitHub"));
      localStorage.setItem("isReload", "true");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "isReload", newValue: "true" }),
      );
      expect(localStorage.getItem("isReload")).toBe("false");
    });

    it("closes right after selecting a provider when closeOnProviderSelect is set", () => {
      unauthorized();
      const onClose = vi.fn();
      renderWithProviders(
        <ProviderButtons
          destination="/x"
          onClose={onClose}
          closeOnProviderSelect
        />,
      );
      fireEvent.click(screen.getByText("Continue with GitHub"));
      expect(authenticateWithGithub).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledWith(true);
    });

    it("routes each enabled provider to its own auth flow", () => {
      unauthorized();
      providerState.override = [
        { id: "gitlab", name: "GitLab", icon: "gitlab", active: true },
        { id: "bitbucket", name: "Bitbucket", icon: "bitbucket", active: true },
        { id: "azure", name: "Azure", icon: "azure", active: true },
        { id: "aws", name: "AWS", icon: "aws", active: true },
      ];
      renderWithProviders(<ProviderButtons destination="/x" />);

      fireEvent.click(screen.getByText("Continue with GitLab"));
      expect(authenticateWithGitlab).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByText("Continue with Bitbucket"));
      expect(authenticateWithBitbucket).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByText("Continue with Azure"));
      expect(authenticateWithAzure).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByText("Continue with AWS"));
      expect(authenticateWithAws).toHaveBeenCalledTimes(1);
      expect(authenticateWithGithub).not.toHaveBeenCalled();
    });

    it("logs an unknown provider and still honours closeOnProviderSelect", () => {
      unauthorized();
      providerState.override = [
        { id: "svn", name: "Subversion", icon: "svn", active: true },
      ];
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const onClose = vi.fn();
      renderWithProviders(
        <ProviderButtons
          destination="/x"
          onClose={onClose}
          closeOnProviderSelect
        />,
      );
      fireEvent.click(screen.getByText("Continue with Subversion"));
      expect(errorSpy).toHaveBeenCalledWith("Unknown provider:", "svn");
      expect(onClose).toHaveBeenCalledWith(true);
    });
  });
});
