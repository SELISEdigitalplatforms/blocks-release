import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/date.util";
import { useParams, useNavigate } from "react-router-dom";
import { useGetCardProjectAndBranch } from "@/cross-modules/deployment/hooks/use-github-info";
import React, { useEffect, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import LiveDeploymentLogs from "@blocks-deployment/components/deployment-details/live/live-logs-section";
import DeploymentGeneralInfo from "@blocks-deployment/components/deployment-details/shared/deployment-general-info";
import { ChevronLeft } from "lucide-react";
import { IDeploymentPageData } from "./deployment-details";
import { IHttpError } from "@blocks-deployment/models/github-info";
import { useProjectStore } from "@/store/project.store";
import { useScopedPath } from "@/hooks/use-scoped-path";

const LiveLogs = () => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
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
        navigate(scoped("deployment"));
      }
    }
  }, [isError, error, navigate]);

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
      <div className="mt-4 flex h-full flex-col items-center gap-4">
        <div className="flex w-full flex-col items-start gap-4">
          <div className="flex w-full justify-start">
            <Button
              onClick={handleSubmit}
              variant={"ghost"}
              className="pl-0 pt-0">
              <ChevronLeft size={20} />
            </Button>
            <h1 className="text-2xl font-bold text-high-emphasis">
              {buildIdStr}
            </h1>
          </div>
          <DeploymentGeneralInfo
            buildId={buildIdStr}
            cardData={cardData}
            isLoading={isLoading}
            isError={isError}
            isSuccess={isSuccess}
            showStatus={false}
          />
          <LiveDeploymentLogs
            buildId={buildIdStr}
            historicalEvents={cardData?.events}
          />
        </div>
      </div>
    </>
  );
};

export default LiveLogs;
