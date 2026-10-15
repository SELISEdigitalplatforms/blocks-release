import { Button } from "@/components/ui-kits/button/button";
import { useProjectStore } from "@/store/project.store";
import DeploymentSettingsModal from "@blocks-deployment/components/deployment-details/deployment-settings-modal/deployment-settings-modal";
import DeploymentActivity from "@blocks-deployment/components/deployment-details/shared/deployment-activity";
import DeploymentObservability from "@blocks-deployment/components/deployment-details/shared/deployment-observability";
import { ArrowUpRight, GitBranch, Rocket, Settings } from "lucide-react";
import LoadingSpinner from "@/components/loader-spinner/loader-spinner";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { cn } from "@/lib/utils";

import { BackIconButton } from "@/components/buttons";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { toast } from "@/hooks/use-toast";
import { useScopedPath } from "@/hooks/use-scoped-path";
import { formatFullDate } from "@/utils/date.util";
import DeleteDeploymentButton from "@blocks-deployment/components/deployment-details/shared/delete-deployment-button";
import DeploymentStatusIndicator from "@blocks-deployment/components/deployment-details/shared/deployment-status-indicator";
import DeploymentTargetLink from "@blocks-deployment/components/deployment-details/shared/deployment-target-link";
import {
  OUTLINE_BUTTON_CLASS,
  SURFACE_CARD_CLASS,
  UNDERLINE_TAB_TRIGGER_CLASS,
  UNDERLINE_TABS_LIST_CLASS,
} from "@blocks-deployment/components/deployment-details/shared/surface-styles";
import { IRepoResponse } from "@blocks-deployment/components/deployment-home/repo-cards/repo-cards";
import SecretsTab from "@blocks-deployment/components/deployment-details/tabs/secrets-tab";
import { REPO_DETAILS_PROVIDERS } from "@blocks-deployment/constants/alert.constant";
import {
  useDeleteDeployment,
  useGetRepoDetails,
  useInitialRepoDeployment,
} from "@/cross-modules/deployment/hooks/use-github-info";
import { DEPLOYMENT_OPTIONS_DETAILS } from "@blocks-deployment/models/deployment-settings";
import { DeploymentFormData, IHttpError } from "@blocks-deployment/models/github-info";
import { TabsContent } from "@radix-ui/react-tabs";
import { useQueryState } from "nuqs";
import Alert from "../components/alert/alert";

export interface IRepoDetailsResponse {
  /** totalCount is the build count across every page, used to size the history pager. */
  data: { repo: IRepoResponse; build: IPipeline[]; totalCount?: number };
  message: string | null;
  statusCode: number;
  errors: string[] | null;
  isSuccess: boolean;
}
interface CustomError {
  errors?: { message: string };
  message?: string;
}

export interface IPipelineEvent {
  id: string;
  buildId: string;
  eventType: string;
  message: string;
  eventGroup: string;
  createdAt: string;
  lastUpdateDate: string;
}

export interface IPipeline {
  blocksUserId: string;
  repoId: string;
  repoName: string;
  repoUrl: string;
  commit: string | null;
  branch: string;
  imageName: string;
  status: string;
  eventName: string;
  duration: number;
  buildImageName: string | null;
  pipelineRunName: string;
  html_url: string | null;
  events: IPipelineEvent[];
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string | null;
  language: string | null;
  lastUpdatedBy: string | null;
  organizationIds: string[];
  tags: string[];
  defaultDeploymentUrl: string;
  customDeploymentURL?: string;
}

// Details shows a single build, History one page of five. Named so each page size is one
// fact rather than a literal buried in a ternary.
const DETAILS_BUILD_PAGE_SIZE = 1;
const HISTORY_BUILD_PAGE_SIZE = 5;

// Field labels in the details grid; matches the repository cards on the overview.
const LABEL_CLASS = "text-[11px] text-muted-foreground";

// The Details tab needs only the newest build; History shows one page of five. Asking
// for a page instead of the whole history is the point of this endpoint's pagination.
function buildPageFor(tabId: string, historyPageNumber: number) {
  return tabId === "history"
    ? { pageNumber: historyPageNumber, pageSize: HISTORY_BUILD_PAGE_SIZE }
    : { pageNumber: 1, pageSize: DETAILS_BUILD_PAGE_SIZE };
}

// History has nothing to show before the first build, so the tab strip there is Details plus
// Environment Variables only. A ?tab=history left over from a deployed repository would
// otherwise select a tab that does not exist and render an empty page.
function preDeployTabFor(tabId: string) {
  return tabId === REPO_DETAILS_PROVIDERS.SECRETS
    ? REPO_DETAILS_PROVIDERS.SECRETS
    : REPO_DETAILS_PROVIDERS.DETAILS;
}

/** The selected project's identifiers, each defaulting to "" while no project is selected. */
function useSelectedProjectInfo() {
  const { selectedProject } = useProjectStore();
  return {
    projectKey: selectedProject?.tenantId || "",
    projectEnvironment: selectedProject?.environment || "",
    projectName: selectedProject?.name || "",
    tenantGroupId: selectedProject?.tenantGroupId || "",
  };
}

export default function RepoDetails() {
  const navigate = useNavigate();
  const params = useParams();
  const repoId = params.repoId as string;

  const [tabId, setTabId] = useQueryState("tab", { defaultValue: "details" });

  const scoped = useScopedPath();
  // A string, unlike the function useScopedPath returns, is stable across renders.
  const deploymentPath = scoped("deployment");
  const { projectKey, projectEnvironment, projectName, tenantGroupId } = useSelectedProjectInfo();

  const [isDeploying, setIsDeploying] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeploymentSettingsForDeploy, setIsDeploymentSettingsForDeploy] = useState(false);
  // 1-based, matching the API. Reset whenever the page would otherwise point past the end.
  const [historyPageNumber, setHistoryPageNumber] = useState(1);

  const { mutate: deployManually } = useInitialRepoDeployment();
  const { mutate: deleteDeployment } = useDeleteDeployment();

  const { mutate: initialDeploy, isPending: isInitialDeploying } = useInitialRepoDeployment();
  // A "?refresh=true" landing bypasses the cached repo details on the first read. Read once
  // up front so the very first query already skips the cache; the effect below only tidies
  // the URL.
  const [forceRefresh, setForceRefresh] = useState(
    () => new URLSearchParams(globalThis.location.search).get("refresh") === "true",
  );

  const { pageNumber: buildPageNumber, pageSize: buildPageSize } = buildPageFor(
    tabId,
    historyPageNumber,
  );

  const {
    data: repoDetails,
    isLoading,
    isError,
    error,
    dataUpdatedAt,
  } = useGetRepoDetails(repoId, {
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    forceRefresh: forceRefresh,
    pageNumber: buildPageNumber,
    pageSize: buildPageSize,
    pollWhileBuilding: true,
  });

  // Total across every page, not the length of the page in hand - the page is five rows
  // whether or not more follow it, so only the server's count can size the pager.
  const totalBuildCount: number = repoDetails?.data?.totalCount ?? 0;

  // A repository switch has to land on page one, otherwise the new repo opens at whatever
  // page the previous one was left on and reads as an empty history. Adjusted during render
  // rather than in an effect so the reset is applied before the stale page is ever painted.
  const [pagedRepoId, setPagedRepoId] = useState(repoId);
  if (pagedRepoId !== repoId) {
    setPagedRepoId(repoId);
    setHistoryPageNumber(1);
  }

  useEffect(() => {
    const searchParams = new URLSearchParams(globalThis.location.search);
    if (searchParams.get("refresh") === "true") {
      const newUrl = globalThis.location.pathname;
      globalThis.history.replaceState({}, "", newUrl);
    }
  }, []);

  // The forced read is a one-off: once fresh details are in, later reads use the cache again.
  if (repoDetails && forceRefresh) {
    setForceRefresh(false);
  }

  //repo-details switching
  useEffect(() => {
    if (isError && error && typeof error === "object" && "errors" in error) {
      const httpError = error as IHttpError;
      const errorResponse = httpError.errors;

      if (errorResponse.data?.repo === null && errorResponse.isSuccess === false) {
        navigate(deploymentPath);
      }
    }
  }, [isError, error, navigate, deploymentPath]);

  // The repo's branch has no builds to show when the server reports the lookup failed.
  const isBranchMissing =
    (!repoDetails || !repoDetails?.data?.build || !Array.isArray(repoDetails?.data?.build)) &&
    repoDetails?.isSuccess === false;

  const filteredBuilds = useMemo<IPipeline[]>(() => {
    if (isBranchMissing) return [];

    return (
      repoDetails?.data?.build
        .filter((build: IPipeline) => {
          const matchesBranch = build.branch === repoDetails?.data?.repo.branch;
          return matchesBranch;
        })
        .map((build: IPipeline): IPipeline => ({
          ...build,
          events: build.events ?? [],
        })) ?? []
    );
  }, [repoDetails, isBranchMissing]);

  useEffect(() => {
    if (isBranchMissing) {
      toast({
        title: "Branch not found",
        description: `The ${projectEnvironment} branch doesn't exist on this repository. Please create a branch with the name ${projectEnvironment}.`,
        variant: "default",
      });

      const redirectTimer = setTimeout(() => {
        navigate(`/app/project/${tenantGroupId}/environments`);
      }, 5000);

      return () => clearTimeout(redirectTimer);
    }
  }, [repoDetails, isBranchMissing, projectEnvironment, navigate, tenantGroupId]);

  const latestBuild = useMemo(() => {
    // Deliberately the RAW, server-sorted list rather than the branch-filtered one. With
    // a single-item Details request, a build whose branch differs from the repo's would be
    // dropped by that filter and leave this panel silently blank - the server has already
    // narrowed to this repo and sorted newest-first, which is what "latest" means here.
    const builds: IPipeline[] | undefined = repoDetails?.data?.build;

    if (!builds) {
      return null;
    }

    const latest = builds.reduce<IPipeline | null>((latest, current) => {
      if (!latest) return current;

      const latestDate = new Date(latest.createdDate);
      const currentDate = new Date(current.createdDate);

      return currentDate > latestDate ? current : latest;
    }, null);

    return latest;
  }, [repoDetails]);

  const handleGoBack = () => {
    navigate(scoped("deployment"));
  };

  const handleDeploy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeploymentSettingsForDeploy(true);
    setIsSettingsModalOpen(true);
  };

  const handleDeployFromSettings = (deploymentData: DeploymentFormData) => {
    setIsDeploying(true);

    initialDeploy(
      {
        repoId: repoId,
        projectEnv: projectEnvironment,
        projectName: projectName,
        deploymentType: deploymentData.deploymentType,
        hostingProviderId: deploymentData.providerId || "",
        regionId: deploymentData.regionId || "",
        machineConfigId: deploymentData.machineConfigId || "",
        viewInBlocksMonitor: deploymentData.viewInBlocksMonitor ?? false,
      },
      {
        onSuccess: (deployResponse) => {
          if (deployResponse && deployResponse.buildId) {
            navigate(scoped(`deployment/repo/${repoId}/deployment-live/${deployResponse.buildId}`));
            setIsDeploying(false);
          } else {
            navigate(scoped("deployment"));
            setIsDeploying(false);
          }
          setIsSettingsModalOpen(false);
          setIsDeploymentSettingsForDeploy(false);

          toast({
            title: "Deployment Started",
            description: "Your deployment has been initiated successfully.",
            variant: "success",
          });

          // The deployment itself went through; only the opted-in monitor could not be created.
          if (deployResponse?.monitorError) {
            toast({
              title: "Blocks Monitor",
              description: deployResponse.monitorError,
              variant: "destructive",
            });
          }
        },
        onError: (error: CustomError) => {
          setIsDeploying(false);
          const errorMessage =
            error?.errors?.message ||
            error?.message ||
            "Failed to start deployment. Please try again.";

          toast({
            title: "Deployment Failed",
            description: errorMessage,
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleManualDeploy = () => {
    setIsDeploying(true);
    deployManually(
      {
        repoId: repoId,
      },
      {
        onSuccess: (response) => {
          if (response && response.buildId) {
            navigate(scoped(`deployment/repo/${repoId}/deployment-live/${response.buildId}`));
            setIsDeploying(false);
          } else {
            navigate(scoped("deployment"));
            setIsDeploying(false);
          }
          setIsModalOpen(false);

          toast({
            title: "Deployment Started",
            description: "Deployment has been initiated successfully.",
            variant: "success",
          });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
          setIsDeploying(false);

          toast({
            title: "Deployment Failed",
            description: error.errors.message,
            variant: "destructive",
          });
        },
        onSettled: () => {
          setIsDeploying(false);
        },
      },
    );
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
  };

  const handleDeleteDeployment = () => {
    setIsDeleting(true);

    deleteDeployment(repoId, {
      onSuccess: (response) => {
        setIsDeleteModalOpen(false);

        toast({
          title: "Deletion Started",
          description:
            response?.message || "The deployment is being removed. This can take up to a minute.",
          variant: "success",
        });
      },
      onError: (error: CustomError) => {
        const errorMessage =
          error?.errors?.message ||
          error?.message ||
          "Failed to delete the deployment. Please try again.";

        toast({
          title: "Deletion Failed",
          description: errorMessage,
          variant: "destructive",
        });
      },
      onSettled: () => {
        setIsDeleting(false);
      },
    });
  };

  const confirmationData = {
    dialogTitle: "Confirm Deployment",
    dialogSubtitle: (
      <>
        Are you sure you want to manually deploy this repository?
        <br />
        <br />
      </>
    ),
    confirmButton: "Deploy Now",
    cancelButton: "Cancel",
  };

  // The recorded namespace is the only authority on whether something is deployed: absent means
  // never deployed, or already deleted. The latest build survives deletion, so it cannot be used here.
  const hasLiveDeployment = Boolean(repoDetails?.data?.repo?.deployedNamespace);

  const deploymentUrl =
    latestBuild?.defaultDeploymentUrl || repoDetails?.data?.repo?.defaultDeploymentUrl || "";

  const repoDisplayName = latestBuild?.repoName.split("/").pop() || latestBuild?.repoName;

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSettings(latestBuild?.itemId || "", repoId);
  };

  const handleSettings = (_buildId: string, _repoId: string) => {
    setIsSettingsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsSettingsModalOpen(false);
    setIsDeploymentSettingsForDeploy(false);
  };

  const isProcessing = isDeploying || isInitialDeploying;

  if (!repoId || !projectKey) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg text-red-600">Missing required parameters:</div>
          <div className="mb-4 text-sm text-low-emphasis">
            repoId: {repoId || "MISSING"}
            <br />
            projectKey: {projectKey || "MISSING"}
          </div>
          <div className="space-x-2">
            <button
              onClick={() => navigate(-1)}
              className="rounded bg-gray-500 px-4 py-2 text-white"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (isLoading) {
    return <LoadingSpinner />;
  }

  const isEmptyHistory = repoDetails?.data?.build.length === 0 && repoDetails?.data?.repo !== null;
  // Environment variables are deliberately reachable before the first deployment: the server
  // keys them on the repository alone, and the first pipeline run reads whatever is stored at
  // that point. Without this the set could only be created after a deployment that needed it.
  const activeTab = isEmptyHistory ? preDeployTabFor(tabId) : tabId;
  const repositoryName = latestBuild?.repoName || repoDetails?.data?.repo.repoName || "Repository";
  const repositoryUrl = latestBuild?.repoUrl || repoDetails?.data?.repo.repoUrl;
  const branch = repoDetails?.data?.repo.branch || "";
  const customUrl = repoDetails?.data?.repo?.customDeploymentUrl;
  const deploymentType =
    DEPLOYMENT_OPTIONS_DETAILS.find(
      (option) =>
        option.value.toLowerCase() === repoDetails?.data?.repo.deploymentType?.toLowerCase(),
    )?.label || "N/A";

  const tabChangedHandler = (value: string) => {
    setTabId(value);
  };
  // The Pagination control is 0-based; the API is 1-based.
  const handleHistoryPageChange = (pageIndex: number) => {
    setHistoryPageNumber(pageIndex + 1);
  };

  return (
    <div className="mx-auto min-w-0 pb-8">
      {/* Same rhythm as PageHeader: title, subtitle, then mb-4 / sm:mb-6. */}
      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-1">
          <BackIconButton
            onClick={handleGoBack}
            data-testid="back-button"
            className="-ml-1.5 h-7 w-7 shrink-0 sm:h-8 sm:w-8"
          />
          <div className="min-w-0 space-y-1">
            <h1 className="break-words text-xl font-semibold tracking-tight text-high-emphasis sm:text-2xl">
              {repositoryName.split("/").pop()}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              {repositoryUrl ? (
                <a
                  href={repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1.5 hover:text-primary"
                >
                  <span className="break-all">{repositoryName}</span>
                  <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
              ) : (
                <span>{repositoryName}</span>
              )}
              {branch && (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary/[0.07] px-2 py-1 text-xs font-medium text-primary">
                  <GitBranch className="h-3 w-3" aria-hidden="true" />
                  {branch}
                </span>
              )}
            </div>
          </div>
        </div>
        {!isEmptyHistory && (
          <div className="flex flex-wrap items-center gap-1">
            {/* Tracing and Logs stay hidden until they are available for repositories. */}
            <Button
              size="sm"
              variant="outline"
              className={cn("gap-2", OUTLINE_BUTTON_CLASS)}
              onClick={handleSettingsClick}
            >
              <Settings size={16} />
              Configure
            </Button>
          </div>
        )}
      </header>

      <Tabs value={activeTab} onValueChange={tabChangedHandler}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="md:hidden">
            <Select value={activeTab} onValueChange={tabChangedHandler}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="details">Details</SelectItem>
                {!isEmptyHistory && <SelectItem value="history">History</SelectItem>}
                <SelectItem value="secrets">Environment Variables</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="hidden min-w-0 md:block">
            <TabsList className={cn(UNDERLINE_TABS_LIST_CLASS, "gap-6")}>
              <TabsTrigger value="details" className={UNDERLINE_TAB_TRIGGER_CLASS}>
                Details
              </TabsTrigger>
              {!isEmptyHistory && (
                <TabsTrigger value="history" className={UNDERLINE_TAB_TRIGGER_CLASS}>
                  History
                </TabsTrigger>
              )}
              <TabsTrigger value="secrets" className={UNDERLINE_TAB_TRIGGER_CLASS}>
                Environment Variables
              </TabsTrigger>
            </TabsList>
          </div>
          {!isEmptyHistory && (
            <div className="flex items-center gap-2">
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsModalOpen(true)}
                    disabled={isDeploying || isDeleting}
                    className="gap-2"
                  >
                    <Rocket size={16} />
                    {isDeploying ? "Deploying..." : "Deploy"}
                  </Button>
                </DialogTrigger>
                <ConfirmationModal
                  data={confirmationData}
                  onCancel={handleCancel}
                  onConfirm={handleManualDeploy}
                  buttonState={{ confirm: { disable: isDeploying } }}
                />
              </Dialog>
              <DeleteDeploymentButton
                hasLiveDeployment={hasLiveDeployment}
                repoName={repoDisplayName}
                deploymentUrl={deploymentUrl}
                isDeleting={isDeleting}
                isDisabled={isDeploying}
                isModalOpen={isDeleteModalOpen}
                onModalOpenChange={setIsDeleteModalOpen}
                onConfirm={handleDeleteDeployment}
                onCancel={handleDeleteCancel}
              />
            </div>
          )}
        </div>

        <div className={SURFACE_CARD_CLASS}>
          <TabsContent value="details">
            {isEmptyHistory ? (
              <section className="flex min-h-72 flex-col items-center justify-center px-4 py-10 text-center">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-sm bg-primary/[0.07] text-primary">
                  <Rocket className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">No deployments available</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Add your environment variables, then deploy this repository to bring your
                  application online.
                </p>
                <Button
                  onClick={handleDeploy}
                  size="sm"
                  disabled={isProcessing}
                  className="mt-6 gap-2"
                >
                  <Rocket size={16} />
                  Deploy Now
                </Button>
              </section>
            ) : (
              <div className="space-y-10">
                <section aria-label="Deployment details">
                  <dl className="grid grid-cols-2 gap-x-5 gap-y-5 sm:gap-x-10 xl:grid-cols-3">
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <dt className={LABEL_CLASS}>Deploys To</dt>
                      <dd className="mt-1.5 min-w-0">
                        <DeploymentTargetLink isLive={hasLiveDeployment} url={deploymentUrl} />
                      </dd>
                    </div>
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <dt className={LABEL_CLASS}>Repo URL</dt>
                      <dd className="mt-1.5">
                        <a
                          href={repositoryUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-sm text-primary hover:underline"
                          title={repositoryUrl}
                        >
                          {repositoryUrl || "N/A"}
                        </a>
                      </dd>
                    </div>
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <dt className={LABEL_CLASS}>Custom Deployment URL</dt>
                      <dd className="mt-1.5">
                        {customUrl && customUrl !== "N/A" ? (
                          <CopyToClipboardButton textToCopy={customUrl} isHoverable={false}>
                            <a
                              href={customUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-sm text-primary hover:underline"
                              title={customUrl}
                            >
                              {customUrl}
                            </a>
                          </CopyToClipboardButton>
                        ) : (
                          <span className="text-sm text-muted-foreground">N/A</span>
                        )}
                      </dd>
                    </div>
                    <div data-testid="deployment-status">
                      <dt className={LABEL_CLASS}>Deployment Status</dt>
                      <dd className="mt-1.5">
                        <DeploymentStatusIndicator
                          hasLiveDeployment={hasLiveDeployment}
                          latestBuild={latestBuild}
                          buildStatus={latestBuild?.status}
                          repoStatus={repoDetails?.data?.repo?.lastDeploymentStatus}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className={LABEL_CLASS}>Latest Deployment Date</dt>
                      <dd className="mt-1.5 text-sm font-medium text-high-emphasis">
                        {latestBuild
                          ? formatFullDate(
                              new Date(repoDetails?.data?.repo?.lastDeploymentDate as string),
                            )
                          : "N/A"}
                      </dd>
                    </div>
                    <div>
                      <dt className={LABEL_CLASS}>Deployment Type</dt>
                      <dd className="mt-1.5 text-sm font-medium text-high-emphasis">
                        {deploymentType}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section aria-label="Latest deployment" className="min-w-0">
                  <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold text-high-emphasis">
                      Latest deployment
                    </h2>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => tabChangedHandler(REPO_DETAILS_PROVIDERS.HISTORY)}
                    >
                      View all history <span aria-hidden="true">↗</span>
                    </button>
                  </div>
                  <div className="mb-6">
                    <DeploymentObservability
                      builds={filteredBuilds}
                      viewLatestBuild
                      dataUpdatedAt={dataUpdatedAt}
                    />
                  </div>
                  <DeploymentActivity
                    key={`${projectKey}-${repoId}-${branch}`}
                    repoId={repoId}
                    branch={branch}
                  />
                </section>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <section aria-label="Deployment history" className="min-w-0 space-y-6">
              <DeploymentActivity
                key={`${projectKey}-${repoId}-${branch}`}
                repoId={repoId}
                branch={branch}
                defaultView="3d"
              />
              <DeploymentObservability
                builds={filteredBuilds}
                startIndex={(historyPageNumber - 1) * HISTORY_BUILD_PAGE_SIZE + 1}
                totalCount={totalBuildCount}
                dataUpdatedAt={dataUpdatedAt}
              />
              {totalBuildCount > HISTORY_BUILD_PAGE_SIZE && (
                <div className="flex items-center justify-end">
                  <Pagination
                    page={historyPageNumber - 1}
                    pageSize={HISTORY_BUILD_PAGE_SIZE}
                    onChange={handleHistoryPageChange}
                    totalCount={totalBuildCount}
                  />
                </div>
              )}
            </section>
          </TabsContent>
          <TabsContent value="secrets">
            <SecretsTab repoId={repoId} repoName={repoDetails?.data?.repo.repoName} />
          </TabsContent>
        </div>
        {!isEmptyHistory && activeTab === "details" && (
          <div className="mt-6">
            <Alert
              repoId={repoId}
              status={latestBuild?.status || ""}
              latestBuild={latestBuild}
              buildLength={filteredBuilds?.length}
            />
          </div>
        )}
      </Tabs>

      <DeploymentSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseModal}
        repoId={repoId}
        isDeploymentFlow={isDeploymentSettingsForDeploy}
        onDeploy={handleDeployFromSettings}
        isDeploying={isDeploying}
        pageNumber={buildPageNumber}
        pageSize={buildPageSize}
      />
    </div>
  );
}
