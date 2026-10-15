/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LogoLoader } from "@/components/loader-spinner/logo-loader";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { useGetCardProjectAndBranch } from "@/cross-modules/deployment/hooks/use-github-info";
import { toast } from "@/hooks/use-toast";
import DeploymentSettingsModal from "@blocks-deployment/components/deployment-details/deployment-settings-modal/deployment-settings-modal";
import { BackIconButton } from "@/components/buttons";
import DeploymentLogsTab from "@blocks-deployment/components/deployment-details/tabs/deployment-logs-tab";
import SASTTab from "@blocks-deployment/components/deployment-details/tabs/sast-tab";
import SCATab from "@blocks-deployment/components/deployment-details/tabs/sca-tab";
import { DeploymentEventGroup, DeploymentEventType } from "@blocks-deployment/models/live-logs";
import ComingSoonTab from "@blocks-deployment/components/deployment-details/tabs/coming-soon";
import { IHttpError } from "@blocks-deployment/models/github-info";
import { useScopedPath } from "@/hooks/use-scoped-path";
import {
  UNDERLINE_TAB_TRIGGER_CLASS,
  UNDERLINE_TABS_LIST_CLASS,
} from "@blocks-deployment/components/deployment-details/shared/surface-styles";

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
  const scoped = useScopedPath();
  // A string, unlike the function useScopedPath returns, is stable across renders.
  const deploymentPath = scoped("deployment");
  const { buildId } = useParams();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");

  const buildIdStr = useMemo(() => {
    return Array.isArray(buildId) ? buildId[0] : buildId;
  }, [buildId]);

  const [activeTab, setActiveTab] = useState(() => tabFromUrl || "deployment-logs");
  // A ?tab= in the URL selects that tab, including when it changes later.
  const [syncedTabFromUrl, setSyncedTabFromUrl] = useState(tabFromUrl);
  if (syncedTabFromUrl !== tabFromUrl) {
    setSyncedTabFromUrl(tabFromUrl);
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const queryResult = useGetCardProjectAndBranch(buildIdStr ?? "");
  const { data: apiResponse, isSuccess, isError, error, isLoading, refetch } = queryResult;

  const cardData = (apiResponse as IDeploymentResponse | undefined)?.data;

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
          <LogoLoader size={40} label="Loading deployment details" />
          <p className="mt-4 text-sm text-muted-foreground">Loading deployment details...</p>
        </div>
      </div>
    );
  }

  const activeTabData = tabs.find((tab) => tab.id === activeTab);
  const ActiveTabComponent = activeTabData?.component;

  return (
    <>
      <div className="w-full">
        <div className="w-full">
          {/* Same rhythm as PageHeader: title, subtitle, then mb-4 / sm:mb-6. */}
          <header className="mb-4 flex items-start gap-1 sm:mb-6">
            <BackIconButton
              onClick={handleGoBack}
              className="-ml-1.5 h-7 w-7 shrink-0 sm:h-8 sm:w-8"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <h1 className="break-all text-xl font-semibold tracking-tight text-high-emphasis sm:text-2xl">
                {buildIdStr}
              </h1>
              <p className="text-sm text-muted-foreground">
                {cardData?.repoName
                  ? `Build of ${cardData.repoName.split("/").pop()}${cardData.branch ? ` on ${cardData.branch}` : ""} · logs and security reports`
                  : "Deployment logs and security reports for this build"}
              </p>
            </div>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList aria-label="Build details" className={UNDERLINE_TABS_LIST_CLASS}>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className={UNDERLINE_TAB_TRIGGER_CLASS}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={activeTab} className="mt-4 w-full">
              {ActiveTabComponent && (
                <ActiveTabComponent
                  buildId={buildIdStr}
                  cardData={cardData}
                  isLoading={isLoading}
                  isError={isError}
                  isSuccess={isSuccess}
                />
              )}
            </TabsContent>
          </Tabs>
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
