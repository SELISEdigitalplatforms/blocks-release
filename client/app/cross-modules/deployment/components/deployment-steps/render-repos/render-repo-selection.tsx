import { useState } from "react";
import { Check, ChevronsUpDown, Github, GitBranch } from "lucide-react";
import { useGithubBranches } from "@blocks-deployment/hooks/github-info";
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

const RepositorySelector = ({
  repositories,
  selectedRepo,
  selectedBranch,
  onRepoSelect,
  onBranchSelect,
}: RepositorySelectorProps) => {
  const [repoSearchTerm, setRepoSearchTerm] = useState("");
  const [branchSearchTerm, setBranchSearchTerm] = useState("");
  const [, setRepoUrl] = useState("");

  const { data: branchesData } = useGithubBranches(selectedRepo || "");
  const defaultBranches: IBranch[] = [
    { name: "main", commit: { sha: "", url: "" } },
  ];

  const apiBranches: IBranch[] =
    selectedRepo && branchesData
      ? Array.isArray(branchesData)
        ? branchesData
        : []
      : [];

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

  const handleSelectRepo = (repoFullName: string, html_url: string) => {
    onRepoSelect(repoFullName, html_url); // Pass both values
    setRepoUrl(html_url);
    onBranchSelect(null);
    setRepoSearchTerm("");
  };

  const handleSelectBranch = (branchName: string) => {
    onBranchSelect(branchName);
    setBranchSearchTerm("");
  };

  let applicationDomain = "";
  const persistedData = localStorage.getItem("project-store");
  if (persistedData) {
    const parsedData = JSON.parse(persistedData);
    applicationDomain = parsedData.state.selectedProject.applicationDomain;
  }

  return (
    <div className="flex h-auto w-full flex-col items-start justify-center gap-5 self-stretch rounded-sm border border-border-default bg-background px-5 pb-6 pt-5">
      <h3 className="text-lg font-semibold">
        Select your repository and branch
      </h3>
      <WarningBanner />
      {repositories ? (
        <div className="w-full space-y-4">
          {/* Repository Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Github repository</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border border-blocks-primary-shades-300 bg-background px-3 py-2 text-left focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary">
                  <div className="flex items-center gap-2 truncate">
                    {selectedRepo ? (
                      <>
                        <Github size={16} className="shrink-0" />
                        <span className="truncate">{selectedRepo}</span>
                      </>
                    ) : (
                      <span className="text-low-emphasis">
                        Select repository
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-[300px] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
                <div className="sticky top-0 border-b bg-background p-2">
                  <input
                    type="text"
                    placeholder="Search repository..."
                    className="border-default focus:ring-default w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
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
                        ? "No repositories found matching your search"
                        : "No repositories found"}
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Branch Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Branch</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={!selectedRepo}
                  className={`flex w-full items-center justify-between rounded-md border border-blocks-primary-shades-300 px-3 py-2 text-left focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${
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
                          ? "Select branch"
                          : "Select repository first"}
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-[300px] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
                <div className="sticky top-0 border-b bg-background p-2">
                  <input
                    type="text"
                    placeholder="Search branch..."
                    className="focus:ring- w-full rounded-md border border-low-emphasis px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    value={branchSearchTerm}
                    onChange={(e) => setBranchSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {filteredBranches.length > 0 ? (
                    filteredBranches.map((branch) => (
                      <DropdownMenuItem
                        key={branch.name}
                        onClick={() => handleSelectBranch(branch.name!)}
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
                      {branchSearchTerm
                        ? "No branches found matching your search"
                        : "No branches found"}
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-5">
              Your project will be deployed on
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
          No repositories available
        </div>
      )}
    </div>
  );
};

export default RepositorySelector;
