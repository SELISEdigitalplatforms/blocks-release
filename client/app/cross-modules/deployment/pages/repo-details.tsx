import { Button } from "@/components/ui-kits/button/button";
import { useProjectStore } from "@/store/project.store";
import DeploymentSettingsModal from "@blocks-deployment/components/deployment-details/deployment-settings-modal/deployment-settings-modal";
import DeploymentObservability from "@blocks-deployment/components/deployment-details/shared/deployment-observability";
import { ChartGantt, GitBranch, Logs, Rocket, Settings } from "lucide-react";
import LoadingSpinner from "@/components/loader-spinner/loader-spinner";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { BackIconButton } from "@/components/buttons";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Separator } from "@/components/ui-kits/separator/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { toast } from "@/hooks/use-toast";
import { useScopedPath } from "@/hooks/use-scoped-path";
import { formatFullDate } from "@/utils/date.util";
import DeleteDeploymentButton from "@blocks-deployment/components/deployment-details/shared/delete-deployment-button";
import DeploymentStatusIndicator from "@blocks-deployment/components/deployment-details/shared/deployment-status-indicator";
import DeploymentTargetLink from "@blocks-deployment/components/deployment-details/shared/deployment-target-link";
import { IRepoResponse } from "@blocks-deployment/components/deployment-home/repo-cards/repo-cards";
import SecretsTab from "@blocks-deployment/components/deployment-details/tabs/secrets-tab";
import { REPO_DETAILS_PROVIDERS } from "@blocks-deployment/constants/alert.constant";
import {
  useDeleteDeployment,
  useGetRepoDetails,
  useInitialRepoDeployment,
} from "@/cross-modules/deployment/hooks/use-github-info";
import { DEPLOYMENT_OPTIONS_DETAILS } from "@blocks-deployment/models/deployment-settings";
import {
  DeploymentFormData,
  IHttpError,
} from "@blocks-deployment/models/github-info";
import { TabsContent } from "@radix-ui/react-tabs";
import { useQueryState } from "nuqs";
import Alert from "../components/alert/alert";

export interface IRepoDetailsResponse {
  data: { repo: IRepoResponse; build: IPipeline[] };
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

export default function RepoDetails() {
  const navigate = useNavigate();
  const params = useParams();
  const repoId = params.repoId as string;

  const [tabId, setTabId] = useQueryState("tab", { defaultValue: "details" });

  const scoped = useScopedPath();
  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const projectEnvironment =
    useProjectStore().selectedProject?.environment || "";
  const projectName = useProjectStore().selectedProject?.name || "";
  const tenantGroupId = useProjectStore().selectedProject?.tenantGroupId || "";

  const [isDeploying, setIsDeploying] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [filteredBuilds, setFilteredBuilds] = useState<IPipeline[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeploymentSettingsForDeploy, setIsDeploymentSettingsForDeploy] =
    useState(false);
  // 1-based, matching the API. Reset whenever the page would otherwise point past the end.
  const [historyPageNumber, setHistoryPageNumber] = useState(1);

  const { mutate: deployManually } = useInitialRepoDeployment();
  const { mutate: deleteDeployment } = useDeleteDeployment();

  const { mutate: initialDeploy, isPending: isInitialDeploying } =
    useInitialRepoDeployment();
  const [forceRefresh, setForceRefresh] = useState(false);

  // The Details tab needs only the newest build; History shows one page of five. Asking
  // for a page instead of the whole history is the point of this endpoint's pagination.
  const isHistoryTab = tabId === "history";
  const buildPageSize = isHistoryTab
    ? HISTORY_BUILD_PAGE_SIZE
    : DETAILS_BUILD_PAGE_SIZE;
  const buildPageNumber = isHistoryTab ? historyPageNumber : 1;

  const {
    data: repoDetails,
    isLoading,
    isError,
    error,
  } = useGetRepoDetails(repoId, {
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    forceRefresh: forceRefresh,
    pageNumber: buildPageNumber,
    pageSize: buildPageSize,
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
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("refresh") === "true") {
      setForceRefresh(true);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  useEffect(() => {
    if (repoDetails && forceRefresh) {
      setForceRefresh(false);
    }
  }, [repoDetails, forceRefresh]);

  //repo-details switching
  useEffect(() => {
    if (isError && error && typeof error === "object" && "errors" in error) {
      const httpError = error as IHttpError;
      const errorResponse = httpError.errors;

      if (
        errorResponse.data?.repo === null &&
        errorResponse.isSuccess === false
      ) {
        navigate(scoped("deployment"));
      }
    }
  }, [isError, error, navigate]);

  useEffect(() => {
    if (
      (!repoDetails ||
        !repoDetails?.data?.build ||
        !Array.isArray(repoDetails?.data?.build)) &&
      repoDetails?.isSuccess === false
    ) {
      setFilteredBuilds([]);
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

    const filtered = repoDetails?.data?.build
      .filter((build: IPipeline) => {
        const matchesBranch = build.branch === repoDetails?.data?.repo.branch;
        return matchesBranch;
      })
      .map(
        (build: IPipeline): IPipeline => ({
          ...build,
          events: [],
        }),
      );

    setFilteredBuilds(filtered);
  }, [repoDetails, projectEnvironment, navigate]);

  const latestBuild = useMemo(() => {
    // Deliberately the RAW, server-sorted list rather than the branch-filtered one. With
    // a single-item Details request, a build whose branch differs from the repo's would be
    // dropped by that filter and leave this panel silently blank - the server has already
    // narrowed to this repo and sorted newest-first, which is what "latest" means here.
    const builds: IPipeline[] | undefined = repoDetails?.data?.build;

    if (!builds) {
      return null;
    }

    const latest = builds.reduce<IPipeline | null>(
      (latest, current) => {
        if (!latest) return current;

        const latestDate = new Date(latest.createdDate);
        const currentDate = new Date(current.createdDate);

        return currentDate > latestDate ? current : latest;
      },
      null,
    );

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
      },
      {
        onSuccess: (deployResponse) => {
          if (deployResponse && deployResponse.buildId) {
            navigate(
              scoped(`deployment/repo/${repoId}/deployment-live/${deployResponse.buildId}`),
            );
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
            navigate(
              scoped(`deployment/repo/${repoId}/deployment-live/${response.buildId}`),
            );
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
            response?.message ||
            "The deployment is being removed. This can take up to a minute.",
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
    latestBuild?.defaultDeploymentUrl ||
    repoDetails?.data?.repo?.defaultDeploymentUrl ||
    "";

  const repoDisplayName =
    latestBuild?.repoName.split("/").pop() || latestBuild?.repoName;

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
          <div className="mb-4 text-lg text-red-600">
            Missing required parameters:
          </div>
          <div className="mb-4 text-sm text-low-emphasis">
            repoId: {repoId || "MISSING"}
            <br />
            projectKey: {projectKey || "MISSING"}
          </div>
          <div className="space-x-2">
            <button
              onClick={() => navigate(-1)}
              className="rounded bg-gray-500 px-4 py-2 text-white">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (isLoading) {
    return <LoadingSpinner variant="overlay" label="Loading..." />;
  }

  if (
    repoDetails?.data?.build.length === 0 &&
    repoDetails?.data?.repo !== null
  ) {
    return (
      <div className="mx-auto pb-8">
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <BackIconButton onClick={handleGoBack} data-testid="back-button" />
            <div>
              <h1 className="text-2xl font-semibold">Repository Details</h1>
              <div className="text-sm text-muted-foreground">
                {repoDetails?.data?.repo.repoName || ""}
              </div>
            </div>
          </div>

          <Card>
            <div className="flex h-auto flex-col items-center justify-center self-stretch rounded-sm bg-background px-1 py-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <GitBranch className="h-8 w-8 text-low-emphasis" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <h3 className="py-4 text-xl font-semibold text-high-emphasis">
                  No deployments available
                </h3>

                <p className="max-w-md items-center text-center text-sm text-low-emphasis">
                  This repository has not been deployed yet. Click the deploy
                  button to create your first deployment.
                </p>
              </div>
              <Button
                onClick={handleDeploy}
                disabled={isProcessing}
                className="mt-4">
                Deploy Now
              </Button>
            </div>
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
          </Card>
        </div>
      </div>
    );
  }
  const tabChangedHandler = (value: keyof typeof REPO_DETAILS_PROVIDERS) => {
    setTabId(value);
  };
  // The Pagination control is 0-based; the API is 1-based.
  const handleHistoryPageChange = (pageIndex: number) => {
    setHistoryPageNumber(pageIndex + 1);
  };

  return (
    <>
      <div className="mx-auto pb-8">
        <div className="mt-2 space-y-2">
          <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <BackIconButton
                onClick={handleGoBack}
                data-testid="back-button"
              />
              <div>
                <h1 className="text-lg font-semibold sm:text-2xl">
                  {latestBuild?.repoName.split("/").pop() ||
                    latestBuild?.repoName}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="outline" disabled>
                <div className="flex h-8 w-8 items-center justify-center">
                  <ChartGantt size={20} />
                </div>
                <span className="hidden sm:inline">Tracing</span>
              </Button>
              <Button variant="outline" disabled>
                <div className="flex h-8 w-8 items-center justify-center">
                  <Logs size={20} />
                </div>
                <span className="hidden sm:inline">Logs</span>
              </Button>

              <Button variant="outline" onClick={handleSettingsClick}>
                <div className="flex h-8 w-8 items-center justify-center">
                  <Settings size={20} />
                </div>
                <span className="hidden sm:inline">Configure</span>
              </Button>
            </div>
          </div>
          <Tabs
            value={tabId}
            onValueChange={(value: string) =>
              tabChangedHandler(value as keyof typeof REPO_DETAILS_PROVIDERS)
            }>
            <div className="mb-5 mt-6 flex items-center justify-between rounded text-base">
              <div className="md:hidden">
                <Select
                  value={tabId}
                  onValueChange={(value: string) =>
                    tabChangedHandler(
                      value as keyof typeof REPO_DETAILS_PROVIDERS,
                    )
                  }>
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="details">Details</SelectItem>
                    <SelectItem value="history">History</SelectItem>
                    <SelectItem value="secrets">Environment Variables</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden md:block">
                <TabsList>
                  <TabsTrigger value="details" className="w-20">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="history" className="w-20">
                    History
                  </TabsTrigger>
                  <TabsTrigger value="secrets" className="px-4">
                    Environment Variables
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
            <TabsContent value="details">
              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {" "}
                    <h3 className="text-lg font-semibold">
                      Deployment Information
                    </h3>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            onClick={() => setIsModalOpen(true)}
                            disabled={isDeploying || isDeleting}
                            className="w-full shadow-sm sm:w-auto">
                            <div className="flex items-center justify-center gap-2">
                              <Rocket size={20} />
                              <span>
                                {isDeploying ? "Deploying..." : "Deploy"}
                              </span>
                            </div>
                          </Button>
                        </DialogTrigger>
                        <ConfirmationModal
                          data={confirmationData}
                          onCancel={handleCancel}
                          onConfirm={handleManualDeploy}
                          buttonState={{
                            confirm: { disable: isDeploying },
                          }}
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
                  </CardHeader>
                  <CardContent>
                    {" "}
                    <div className="my-2 grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-sm text-low-emphasis">Repo URL</p>
                          <a
                            href={latestBuild?.repoUrl || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-sm text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}>
                            {latestBuild?.repoUrl || "N/A"}
                          </a>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm text-low-emphasis">
                            Deploys To
                          </p>
                          <DeploymentTargetLink
                            isLive={hasLiveDeployment}
                            url={deploymentUrl}
                          />
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm text-low-emphasis">
                            Custom Deployment URL
                          </p>
                          {repoDetails?.data?.repo?.customDeploymentUrl &&
                          repoDetails?.data?.repo?.customDeploymentUrl !==
                            "N/A" ? (
                            <CopyToClipboardButton
                              textToCopy={
                                repoDetails?.data?.repo?.customDeploymentUrl
                              }
                              isHoverable={false}>
                              <a
                                href={
                                  repoDetails?.data?.repo?.customDeploymentUrl
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block truncate text-sm text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}>
                                {repoDetails?.data?.repo?.customDeploymentUrl}
                              </a>
                            </CopyToClipboardButton>
                          ) : (
                            <span className="block truncate text-sm">
                              {"N/A"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:mb-4 md:gap-6">
                        <div className="space-y-4">
                          <div className="space-y-2" data-testid="deployment-status">
                            <p className="text-sm text-low-emphasis">
                              Deployment Status
                            </p>
                            <DeploymentStatusIndicator
                              hasLiveDeployment={hasLiveDeployment}
                              latestBuild={latestBuild}
                              buildStatus={latestBuild?.status}
                              repoStatus={
                                repoDetails?.data?.repo?.lastDeploymentStatus
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm text-low-emphasis">
                              Latest Deployment Date
                            </p>
                            <span className="text-sm">
                              {latestBuild
                                ? formatFullDate(
                                    new Date(
                                      repoDetails?.data?.repo
                                        ?.lastDeploymentDate,
                                    ),
                                  )
                                : "N/A"}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm text-low-emphasis">
                              Deployment Type
                            </p>
                            <span className="text-sm">
                              {(() => {
                                const result =
                                  DEPLOYMENT_OPTIONS_DETAILS.find(
                                    (option) =>
                                      option.value.toLowerCase() ===
                                      repoDetails?.data.repo.deploymentType?.toLowerCase(),
                                  )?.label || "N/A";
                                return result;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="w-full">
                      <Separator
                        orientation="horizontal"
                        className="my-2 w-full"
                      />

                      <div className="flex w-full flex-col gap-3 pb-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-lg font-semibold">
                          Deployment History
                        </h3>
                      </div>
                      <DeploymentObservability
                        builds={filteredBuilds}
                        viewLatestBuild={true}
                      />
                    </div>
                  </CardContent>
                </Card>
                <Alert
                  repoId={repoId}
                  status={latestBuild?.status || ""}
                  latestBuild={latestBuild}
                  buildLength={filteredBuilds?.length}
                />
              </div>
            </TabsContent>
            <TabsContent value="history">
              <Card>
                <div className="flex w-full flex-col gap-3 pb-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col items-start gap-2">
                    <h3 className="text-lg font-semibold">
                      Deployment History
                    </h3>
                  </div>
                </div>
                <DeploymentObservability
                  builds={filteredBuilds}
                  startIndex={
                    (historyPageNumber - 1) * HISTORY_BUILD_PAGE_SIZE + 1
                  }
                  totalCount={totalBuildCount}
                />
                {totalBuildCount > HISTORY_BUILD_PAGE_SIZE && (
                  <div className="mt-4 flex items-center px-4 pb-4 md:justify-end">
                    <Pagination
                      page={historyPageNumber - 1}
                      pageSize={HISTORY_BUILD_PAGE_SIZE}
                      onChange={handleHistoryPageChange}
                      totalCount={totalBuildCount}
                    />
                  </div>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="secrets">
              <SecretsTab
                repoId={repoId}
                repoName={repoDetails?.data?.repo.repoName}
              />
            </TabsContent>
          </Tabs>
        </div>

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
    </>
  );
}
