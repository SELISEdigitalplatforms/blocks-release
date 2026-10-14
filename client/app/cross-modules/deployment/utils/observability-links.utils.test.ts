import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEPENDENCY_TRACK_PORTAL_URL,
  SONARQUBE_PORTAL_URL,
  getDependencyTrackProjectUrl,
  getSonarQubeDashboardUrl,
  openResolvedUrlInNewTab,
} from "./observability-links.utils";

describe("getSonarQubeDashboardUrl", () => {
  it("links to the project and branch dashboard", () => {
    expect(
      getSonarQubeDashboardUrl({
        data: { projectKey: "asifrafeen-blocks-os-construct", branch: "dev" },
      }),
    ).toBe("https://code.selise.biz/dashboard?id=asifrafeen-blocks-os-construct&branch=dev");
  });

  it("encodes a branch that contains a slash", () => {
    expect(
      getSonarQubeDashboardUrl({ data: { projectKey: "org-repo", branch: "feature/login" } }),
    ).toBe("https://code.selise.biz/dashboard?id=org-repo&branch=feature%2Flogin");
  });

  it("omits the branch when it is empty so SonarQube shows the main branch", () => {
    expect(getSonarQubeDashboardUrl({ data: { projectKey: "org-repo", branch: "" } })).toBe(
      "https://code.selise.biz/dashboard?id=org-repo",
    );
    expect(getSonarQubeDashboardUrl({ data: { projectKey: "org-repo", branch: null } })).toBe(
      "https://code.selise.biz/dashboard?id=org-repo",
    );
  });

  it.each([
    ["no response", undefined],
    ["no data", { isSuccess: true }],
    ["null project key", { data: { projectKey: null, branch: "dev" } }],
    ["blank project key", { data: { projectKey: "   ", branch: "dev" } }],
  ])("falls back to the portal root with %s", (_, response) => {
    expect(getSonarQubeDashboardUrl(response)).toBe(SONARQUBE_PORTAL_URL);
  });
});

describe("getDependencyTrackProjectUrl", () => {
  it("links to the project page", () => {
    expect(
      getDependencyTrackProjectUrl({
        data: { projectUuid: "5f1c2a9e-0b7d-4e44-9b1e-2d3c4f5a6b7c" },
      }),
    ).toBe("https://sca.seliseblocks.com/projects/5f1c2a9e-0b7d-4e44-9b1e-2d3c4f5a6b7c");
  });

  it.each([
    ["no response", undefined],
    ["null data", { data: null }],
    ["null uuid", { data: { projectUuid: null } }],
    ["blank uuid", { data: { projectUuid: " " } }],
  ])("falls back to the portal root with %s", (_, response) => {
    expect(getDependencyTrackProjectUrl(response)).toBe(DEPENDENCY_TRACK_PORTAL_URL);
  });
});

describe("openResolvedUrlInNewTab", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the tab before the URL resolves, then points it at the URL", async () => {
    const tab = { opener: {}, location: { href: "about:blank" } } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(tab);
    let resolveUrl: (url: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      resolveUrl = resolve;
    });

    const done = openResolvedUrlInNewTab(() => pending);

    expect(openSpy).toHaveBeenCalledWith("about:blank", "_blank");
    expect(tab.opener).toBeNull();

    resolveUrl("https://code.selise.biz/dashboard?id=org-repo");
    await done;

    expect(tab.location.href).toBe("https://code.selise.biz/dashboard?id=org-repo");
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it("opens the URL directly when the placeholder tab was blocked", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    await openResolvedUrlInNewTab(async () => "https://sca.seliseblocks.com");

    expect(openSpy).toHaveBeenLastCalledWith(
      "https://sca.seliseblocks.com",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
