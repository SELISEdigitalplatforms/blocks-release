import { useState } from "react";
import { useT } from "@seliseblocks/genesis-os";
import { Check, ChevronsUpDown, Github, GitBranch } from "lucide-react";
import { useGithubBranches } from "@/cross-modules/deployment/hooks/use-github-info";
import WarningBanner from "../import-repo/helpers/warning-banner";
import type {
  IBranch,
  IRepository,
} from "@blocks-deployment/models/github-info";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Input } from "@/components/ui-kits/input/input";

interface RepositorySelectorProps {
  repositories: IRepository[] | undefined;
  selectedRepo: string | null;
  selectedBranch: string | null;
  onRepoSelect: (repo: string | null, url: string | null) => void;
  onBranchSelect: (branch: string | null) => void;
}

// Branches from the API for the selected repository; none until a repository is selected.
const branchesFrom = (selectedRepo: string | null | undefined, data: unknown): IBranch[] =>
  selectedRepo && Array.isArray(data) ? (data as IBranch[]) : [];

// Domain of the selected project's first application, from the persisted project store.
const storedApplicationDomain = (): string => {
  const persistedData = localStorage.getItem("project-store");
  if (!persistedData) return "";
  const parsedData = JSON.parse(persistedData);
  return parsedData.state.selectedProject.applications?.[0]?.domain ?? "";
};

type BranchDropdownProps = {
  branches: IBranch[];
  selectedRepo: string | null | undefined;
  selectedBranch: string | null | undefined;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSelect: (branchName: string) => void;
};

const BranchDropdown = ({
  branches,
  selectedRepo,
  selectedBranch,
  searchTerm,
  onSearchChange,
  onSelect,
}: Readonly<BranchDropdownProps>) => {
  const { t } = useT("release.deployment.shared");
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{t("RENDER_REPO_SELECTION.BRANCH")}</label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={!selectedRepo}
            className={`flex w-full items-center justify-between rounded-md border border-blocks-primary-shades-300 px-3 py-2 text-left focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary ${
              !selectedRepo
                ? "cursor-not-allowed opacity-50"
                : "bg-background"
            }`}>
            <div className="flex items-center gap-2 truncate">
              {selectedBranch ? (
                <>
                  <GitBranch size={16} className="shrink-0" />
                  <span className="truncate">{selectedBranch}</span>
                </>
              ) : (
                <span className="text-low-emphasis">
                  {selectedRepo
                    ? t("RENDER_REPO_SELECTION.SELECT_BRANCH")
                    : t("RENDER_REPO_SELECTION.SELECT_REPOSITORY_FIRST")}
                </span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-[300px] min-w-(--radix-dropdown-menu-trigger-width) overflow-y-auto">
          <div className="sticky top-0 border-b bg-background p-2">
            <input
              type="text"
              placeholder={t("RENDER_REPO_SELECTION.SEARCH_BRANCH")}
              className="focus:ring- w-full rounded-md border border-low-emphasis px-3 py-2 text-sm focus:outline-hidden focus:ring-2"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {branches.length > 0 ? (
              branches.map((branch) => (
                <DropdownMenuItem
                  key={branch.name}
                  onClick={() => onSelect(branch.name!)}
                  className="flex items-center gap-2">
                  <GitBranch size={16} />
                  <span className="flex-1">{branch.name}</span>
                  {selectedBranch === branch.name && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-low-emphasis">
                {searchTerm
                  ? t("RENDER_REPO_SELECTION.NO_BRANCHES_MATCH")
                  : t("RENDER_REPO_SELECTION.NO_BRANCHES")}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const RepositorySelector = ({
  repositories,
  selectedRepo,
  selectedBranch,
  onRepoSelect,
  onBranchSelect,
}: RepositorySelectorProps) => {
  const { t } = useT("release.deployment.shared");
  const [repoSearchTerm, setRepoSearchTerm] = useState("");
  const [branchSearchTerm, setBranchSearchTerm] = useState("");
  const [, setRepoUrl] = useState("");

  const { data: branchesData } = useGithubBranches(selectedRepo || "");
  const defaultBranches: IBranch[] = [
    { name: "main", commit: { sha: "", url: "" } },
  ];

  const apiBranches = branchesFrom(selectedRepo, branchesData);

  const validBranches = selectedRepo
    ? apiBranches.filter((branch) => branch.name !== null)
    : defaultBranches;

  const filteredBranches = validBranches.filter(
    (branch) =>
      branch.name &&
      branch.name.toLowerCase().includes(branchSearchTerm.toLowerCase()),
  );

  // ADD THIS: Filter repositories based on search term
  const filteredRepositories =
    repositories?.filter((repo) =>
      repo.full_name.toLowerCase().includes(repoSearchTerm.toLowerCase()),
    ) || [];

  const handleSelectRepo = (repoFullName: string, htmlUrl: string) => {
    onRepoSelect(repoFullName, htmlUrl); // Pass both values
    setRepoUrl(htmlUrl);
    onBranchSelect(null);
    setRepoSearchTerm("");
  };

  const handleSelectBranch = (branchName: string) => {
    onBranchSelect(branchName);
    setBranchSearchTerm("");
  };

  const applicationDomain = storedApplicationDomain();

  return (
    <div className="flex h-auto w-full flex-col items-start justify-center gap-5 self-stretch rounded-sm border border-border-default bg-background px-5 pb-6 pt-5">
      <h3 className="text-lg font-semibold">
        {t("RENDER_REPO_SELECTION.TITLE")}
      </h3>
      <WarningBanner />
      {repositories ? (
        <div className="w-full space-y-4">
          {/* Repository Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("RENDER_REPO_SELECTION.GITHUB_REPOSITORY")}</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border border-blocks-primary-shades-300 bg-background px-3 py-2 text-left focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary">
                  <div className="flex items-center gap-2 truncate">
                    {selectedRepo ? (
                      <>
                        <Github size={16} className="shrink-0" />
                        <span className="truncate">{selectedRepo}</span>
                      </>
                    ) : (
                      <span className="text-low-emphasis">
                        {t("RENDER_REPO_SELECTION.SELECT_REPOSITORY")}
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-[300px] min-w-(--radix-dropdown-menu-trigger-width) overflow-y-auto">
                <div className="sticky top-0 border-b bg-background p-2">
                  <input
                    type="text"
                    placeholder={t("RENDER_REPO_SELECTION.SEARCH_REPOSITORY")}
                    className="border-default focus:ring-default w-full rounded-md border px-3 py-2 text-sm focus:outline-hidden focus:ring-2"
                    value={repoSearchTerm}
                    onChange={(e) => setRepoSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {/* CHANGED: Use filteredRepositories instead of repositories */}
                  {filteredRepositories.length > 0 ? (
                    filteredRepositories.map((repo: IRepository) => (
                      <DropdownMenuItem
                        key={repo.id}
                        onClick={() =>
                          handleSelectRepo(repo.full_name, repo.html_url)
                        }
                        className="flex items-center gap-2">
                        <Github size={16} />
                        <span className="flex-1">{repo.full_name}</span>
                        {selectedRepo === repo.full_name && (
                          <Check className="text-default h-4 w-4" />
                        )}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-medium-emphasis">
                      {repoSearchTerm
                        ? t("RENDER_REPO_SELECTION.NO_REPOSITORIES_MATCH")
                        : t("RENDER_REPO_SELECTION.NO_REPOSITORIES")}
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Branch Dropdown */}
          <BranchDropdown
            branches={filteredBranches}
            selectedRepo={selectedRepo}
            selectedBranch={selectedBranch}
            searchTerm={branchSearchTerm}
            onSearchChange={setBranchSearchTerm}
            onSelect={handleSelectBranch}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium leading-5">
              {t("RENDER_REPO_SELECTION.DEPLOYED_ON")}
            </label>
            <Input
              value={applicationDomain}
              readOnly
              disabled
              className="cursor-not-allowed rounded-md border border-blocks-primary-shades-300 bg-background px-3 py-2 font-normal leading-6 text-high-emphasis"
            />
          </div>
        </div>
      ) : (
        <div className="w-full py-4 text-center text-low-emphasis">
          {t("RENDER_REPO_SELECTION.NO_REPOSITORIES_AVAILABLE")}
        </div>
      )}
    </div>
  );
};

export default RepositorySelector;
