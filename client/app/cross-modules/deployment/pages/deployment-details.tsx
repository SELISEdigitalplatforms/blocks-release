/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui-kits/button/button";
import { useGetCardProjectAndBranch } from "@blocks-deployment/hooks/github-info";
import { toast } from "@/hooks/use-toast";
import DeploymentSettingsModal from "@blocks-deployment/components/deployment-details/deployment-settings-modal/deployment-settings-modal";
import { ChevronLeft } from "lucide-react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import DeploymentLogsTab from "@blocks-deployment/components/deployment-details/tabs/deployment-logs-tab";
import SASTTab from "@blocks-deployment/components/deployment-details/tabs/sast-tab";
import SCATab from "@blocks-deployment/components/deployment-details/tabs/sca-tab";
// import DASTTab from "@blocks-deployment/components/deployment-details/tabs/dast-tab";
import {
  DeploymentEventGroup,
  DeploymentEventType,
} from "@blocks-deployment/models/live-logs";
import ComingSoonTab from "@blocks-deployment/components/deployment-details/tabs/coming-soon";
import { IHttpError } from "@blocks-deployment/models/github-info";

export interface IDeploymentEvent {
  id: string;
  buildId: string;
  eventType: DeploymentEventType;
  message: string;
  eventGroup: DeploymentEventGroup;
  createdAt: string;
  lastUpdateDate?: string;
}

export interface IDeploymentPageData {
  blocksUserId: string;
  repoId: string;
  repoName: string;
  repoUrl: string;
  defaultDeploymentUrl: string;
  customDeploymentUrl: string | null;
  commit: string | null;
  branch: string;
  imageName: string;
  status: string;
  eventName: string;
  duration: number;
  buildImageName: string | null;
  pipelineRunName: string;
  html_url: string | null;
  events: IDeploymentEvent[];
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  language: string | null;
  lastUpdatedBy: string | null;
  organizationIds: string[];
  tags: string[];
  deploymentType?: string | null;
}

export interface IDeploymentResponse {
  data: IDeploymentPageData;
  message: string | null;
  statusCode: number;
  errors: any;
  isSuccess: boolean;
}

const DeploymentDetails = () => {
  const navigate = useNavigate();
  const { repoId, buildId } = useParams();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");

  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const buildIdStr = useMemo(() => {
    return Array.isArray(buildId) ? buildId[0] : buildId;
  }, [buildId]);

  const [activeTab, setActiveTab] = useState("deployment-logs");
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const queryResult = useGetCardProjectAndBranch(buildIdStr ?? "");
  const {
    data: apiResponse,
    isSuccess,
    isError,
    error,
    isLoading,
    refetch,
  } = queryResult;

  const cardData = (apiResponse as IDeploymentResponse | undefined)?.data;

  useEffect(() => {
    if (isError && error && typeof error === "object" && "errors" in error) {
      const httpError = error as IHttpError;
      const errorResponse = httpError.errors;

      if (errorResponse.data === null && errorResponse.isSuccess === false) {
        navigate("/deployment");
      }
    }
  }, [isError, error, navigate]);

  useEffect(() => {
    if (buildIdStr && buildIdStr.trim() !== "") {
      refetch();
    }
  }, [buildIdStr, refetch]);

  const handleCloseModal = useCallback(() => {
    setIsSettingsModalOpen(false);
  }, []);

  const handleGoBack = () => {
    navigate(-1);
  };

  const tabs = useMemo(
    () => [
      {
        id: "deployment-logs",
        label: "Deployment Logs",
        component: DeploymentLogsTab,
      },
      {
        id: "sast",
        label: "SAST",
        component: SASTTab,
      },
      {
        id: "sca",
        label: "SCA",
        component: SCATab,
      },
      {
        id: "dast",
        label: "DAST",
        component: ComingSoonTab,
      },
    ],
    [],
  );

  React.useEffect(() => {
    if (isError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch deployment data",
      });
    }
  }, [isError]);

  if (!buildIdStr) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="text-sm text-gray-600">Loading deployment details...</p>
        </div>
      </div>
    );
  }

  BREADCRUMB_CUSTOM_TITLES[`/deployment/repo/${repoId}/deployment-logs`] =
    "Deployment Overview";
  BREADCRUMB_CUSTOM_TITLES[
    `/deployment/repo/${repoId}/deployment-logs/${buildIdStr}`
  ] = buildIdStr;

  const activeTabData = tabs.find((tab) => tab.id === activeTab);
  const ActiveTabComponent = activeTabData?.component;

  return (
    <>
      <PageBreadcrumb breadcrumbIndex={4} />
      <div className="mb-8 mt-5 flex h-full w-full flex-col items-center gap-4">
        <div className="flex w-full flex-col items-start gap-4">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant={"ghost"} onClick={handleGoBack} className="pl-0">
                <ChevronLeft size={20} />
              </Button>
              <h1 className="text-2xl font-bold text-high-emphasis">
                {buildIdStr}
              </h1>
            </div>
          </div>

          <div className="w-fit">
            <nav className="flex rounded-lg bg-blocks-primary-shades-300 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`mx-0.5 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-background shadow-sm"
                      : "text-medium-emphasis hover:bg-secondary"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="w-full">
            {ActiveTabComponent && (
              <ActiveTabComponent
                buildId={buildIdStr}
                cardData={cardData}
                isLoading={isLoading}
                isError={isError}
                isSuccess={isSuccess}
              />
            )}
          </div>
        </div>
      </div>

      <DeploymentSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseModal}
        repoId={(cardData as any)?.repoId || ""}
      />
    </>
  );
};

export default DeploymentDetails;
