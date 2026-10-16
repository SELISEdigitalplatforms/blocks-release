import { useParams, useNavigate } from "react-router";
import { useGetCardProjectAndBranch } from "@/cross-modules/deployment/hooks/use-github-info";
import React, { useEffect, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import LiveDeploymentLogs from "@blocks-deployment/components/deployment-details/live/live-logs-section";
import DeploymentGeneralInfo from "@blocks-deployment/components/deployment-details/shared/deployment-general-info";
import { BackIconButton } from "@/components/buttons";
import { IDeploymentPageData } from "./deployment-details";
import { IHttpError } from "@blocks-deployment/models/github-info";
import { useProjectStore } from "@/store/project.store";
import { useScopedPath } from "@/hooks/use-scoped-path";

const LiveLogs = () => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  // A string, unlike the function useScopedPath returns, is stable across renders.
  const deploymentPath = scoped("deployment");
  const { repoId, buildId } = useParams();
  const { selectedProject } = useProjectStore();

  const buildIdStr = useMemo(() => {
    return Array.isArray(buildId) ? buildId[0] : buildId;
  }, [buildId]);

  const {
    data: apiResponse,
    isSuccess,
    isError,
    error,
    isLoading,
    refetch,
  } = useGetCardProjectAndBranch(buildIdStr ?? "");
  const cardData = apiResponse?.data as IDeploymentPageData | undefined;

  useEffect(() => {
    if (isError && error && typeof error === "object" && "errors" in error) {
      const httpError = error as IHttpError;
      const errorResponse = httpError.errors;

      if (errorResponse.data === null && errorResponse.isSuccess === false) {
        navigate(deploymentPath);
      }
    }
  }, [isError, error, navigate, deploymentPath]);

  useEffect(() => {
    if (buildIdStr && buildIdStr.trim() !== "") {
      refetch();
    }
  }, [selectedProject, buildIdStr, refetch]);

  React.useEffect(() => {
    if (isError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch deployment data",
      });
    }
  }, [isError]);

  const handleSubmit = () => {
    navigate(scoped(`deployment/repo/${repoId}?refresh=true`));
  };

  return (
    <>
      <div className="w-full">
        <div className="flex w-full flex-col items-start gap-4">
          <header className="mb-0 flex w-full items-start gap-1 sm:mb-2">
            <BackIconButton
              onClick={handleSubmit}
              className="-ml-1.5 h-7 w-7 shrink-0 sm:h-8 sm:w-8"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <h1 className="break-all text-xl font-semibold tracking-tight text-high-emphasis sm:text-2xl">
                {buildIdStr}
              </h1>
              <p className="text-sm text-muted-foreground">
                {cardData?.repoName
                  ? `Live build of ${cardData.repoName.split("/").pop()}${cardData.branch ? ` on ${cardData.branch}` : ""}`
                  : "Live deployment logs for this build"}
              </p>
            </div>
          </header>
          <DeploymentGeneralInfo
            buildId={buildIdStr}
            cardData={cardData}
            isLoading={isLoading}
            isError={isError}
            isSuccess={isSuccess}
            showStatus={false}
          />
          <LiveDeploymentLogs buildId={buildIdStr} historicalEvents={cardData?.events} />
        </div>
      </div>
    </>
  );
};

export default LiveLogs;
