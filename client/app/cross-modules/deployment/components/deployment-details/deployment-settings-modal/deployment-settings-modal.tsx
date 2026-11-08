/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import type {
  DeploymentFormData,
  IHttpError,
} from "@blocks-deployment/models/github-info";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui-kits/radio-group/radio-group";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import {
  useUpdateRepoSettings,
  useGetRepoDetails,
  useGetSpecs,
} from "@/cross-modules/deployment/hooks/use-github-info";
import { toast } from "@/hooks/use-toast";
import {
  DEPLOYMENT_OPTIONS,
  DOMAIN_OPTIONS,
} from "@blocks-deployment/models/deployment-settings";
import { hasCustomDomain } from "@blocks-deployment/utils/custom-domain.utils";
import useIsMobile from "@/hooks/use-is-mobile";
import { useProjectStore } from "@/store/project.store";
import { useNavigate } from "react-router";
import { useScopedPath } from "@/hooks/use-scoped-path";
import { useT } from "@seliseblocks/genesis-os";

interface IDeploymentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoId: string;
  isDeploymentFlow?: boolean;
  onDeploy?: (deploymentData: DeploymentFormData) => void;
  isDeploying?: boolean;
  /** Mirrors the caller's paging so both share one cached repo-details query instead of
   *  issuing a second request. This modal only reads `data.repo`. Defaults match the
   *  endpoint's own defaults for callers that do not paginate. */
  pageNumber?: number;
  pageSize?: number;
}

const DeploymentSettingsModal = ({
  isOpen,
  onClose,
  repoId,
  isDeploymentFlow = false,
  onDeploy,
  isDeploying = false,
  pageNumber = 1,
  pageSize = 30,
}: IDeploymentSettingsModalProps) => {
  const { t } = useT("release.deployment.details");
  const navigate = useNavigate();
  const scoped = useScopedPath();
  // A string, unlike the function useScopedPath returns, is stable across renders.
  const deploymentPath = scoped("deployment");

  const projectEnvironment =
    useProjectStore().selectedProject?.environment || "";
  const projectName = useProjectStore().selectedProject?.name || "";

  const isMobile = useIsMobile();
  const deploymentOptionLabels: Record<string, string> = {
    auto: t("DEPLOYMENT_SETTINGS_MODAL.OPTION_AUTO"),
    manual: t("DEPLOYMENT_SETTINGS_MODAL.OPTION_MANUAL"),
  };
  const domainOptionLabels: Record<string, string> = {
    both: t("DEPLOYMENT_SETTINGS_MODAL.DOMAIN_BOTH"),
    custom: t("DEPLOYMENT_SETTINGS_MODAL.DOMAIN_CUSTOM"),
  };
  const [deploymentData, setDeploymentData] = useState<DeploymentFormData>({
    customDomain: "",
    lastDeploymentStatus: "",
    deploymentType: "auto",
    framework: "",
    provider: "",
    region: "",
    selectedSpec: "",
    providerId: "",
    regionId: "",
    machineConfigId: "",
    isCustomDomainOnly: false,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [viewInBlocksMonitor, setViewInBlocksMonitor] = useState(true);

  /*
  const [preFilledFields, setPreFilledFields] = useState({
    provider: false,
    region: false,
    selectedSpec: false,
  });
  */

  const {
    data: repoDetails,
    isError,
    error,
  } = useGetRepoDetails(repoId, { pageNumber, pageSize });
  const { data: specs, isLoading: isSpecsLoading } = useGetSpecs() as any;
  const { mutate: updateRepoSettings, isPending } = useUpdateRepoSettings({
    onSuccess: () => {
      toast({
        title: t("common:SETTINGS"),
        description: t("DEPLOYMENT_SETTINGS_MODAL.TOAST_UPDATED"),
        variant: "success",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: t("common:SETTINGS"),
        description: t("DEPLOYMENT_SETTINGS_MODAL.TOAST_UPDATE_FAILED"),
        variant: "destructive",
      });
    },
  });
  const specsData = specs?.data;
  // Settings only: the first-deployment flow starts a build without saving settings. The choice
  // means nothing until the repository has a custom domain.
  const showDomainOption =
    !isDeploymentFlow && hasCustomDomain(repoDetails?.data?.repo);

  useEffect(() => {
    if (isError && error && typeof error === "object" && "errors" in error) {
      const httpError = error as IHttpError;
      const errorResponse = httpError.errors;

      if (
        errorResponse.data?.repo === null &&
        errorResponse.isSuccess === false
      ) {
        navigate(deploymentPath);
      }
    }
  }, [isError, error, navigate, deploymentPath]);

  // Fill the form once, the first time the modal is open with the repo and specs loaded.
  // Done while rendering so the form never paints with its empty defaults first.
  if (
    isOpen &&
    repoDetails?.data?.repo &&
    !isInitialized &&
    !isSpecsLoading
  ) {
    const repo = repoDetails.data.repo;
    const preselectedDeploySettings = repo.deploySettings;
    const deploymentType =
      repo.deploymentType === "Manual" ? "manual" : "auto";

    // Fixed defaults: Azure, West Europe, First Active Spec
    const providers = Array.isArray(specsData) ? specsData : [];
    const azureProvider = providers.find(
      (p: any) => p.name.toLowerCase() === "azure",
    );
    const westEuropeRegion = azureProvider?.region?.find(
      (r: any) =>
        r.name.toLowerCase().includes("west") &&
        r.name.toLowerCase().includes("europe"),
    );
    const firstActiveSpec = westEuropeRegion?.machineSpecs?.find(
      (s: any) => s.status === "active",
    );

    setDeploymentData({
      deploymentType,
      framework: "",
      provider:
        azureProvider?.name ||
        preselectedDeploySettings?.hostingProvider?.name ||
        "",
      region:
        westEuropeRegion?.name ||
        preselectedDeploySettings?.region?.name ||
        "",
      selectedSpec:
        firstActiveSpec?.id ||
        preselectedDeploySettings?.machineConfig?.id ||
        "",
      providerId:
        azureProvider?.id ||
        preselectedDeploySettings?.hostingProvider?.id ||
        "",
      regionId:
        westEuropeRegion?.id || preselectedDeploySettings?.region?.id || "",
      machineConfigId:
        firstActiveSpec?.id ||
        preselectedDeploySettings?.machineConfig?.id ||
        "",
      customDomain: preselectedDeploySettings?.customDomain || "",
      lastDeploymentStatus:
        preselectedDeploySettings?.lastDeploymentStatus || "",
      isCustomDomainOnly: Boolean(repo.isCustomDomainOnly),
    });

    setIsInitialized(true);
  }

  const updateFormData = <K extends keyof DeploymentFormData>(
    field: K,
    value: DeploymentFormData[K],
  ) => {
    setDeploymentData((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid = () => {
    return true;
  };

  const handleSave = () => {
    if (!repoId) {
      console.error("repoId is missing");
      return;
    }

    if (isDeploymentFlow) {
      if (onDeploy && isFormValid()) {
        onDeploy({ ...deploymentData, viewInBlocksMonitor });
      }
    } else {
      const payload = {
        repoId: repoId,
        customDomain: deploymentData.customDomain,
        lastDeploymentStatus: deploymentData.lastDeploymentStatus,
        hostingProviderId: deploymentData.providerId,
        regionId: deploymentData.regionId,
        machineConfigId: deploymentData.machineConfigId,
        deploymentType: deploymentData.deploymentType,
        projectEnv: projectEnvironment,
        projectName: projectName,
        // Sent only while offered: left out, the server keeps the stored value.
        isCustomDomainOnly: showDomainOption
          ? Boolean(deploymentData.isCustomDomainOnly)
          : undefined,
      };

      updateRepoSettings(payload);
    }
  };

  const handleClose = () => {
    setDeploymentData({
      deploymentType: "auto",
      framework: "",
      provider: "",
      region: "",
      selectedSpec: "",
      providerId: "",
      regionId: "",
      machineConfigId: "",
      customDomain: "",
      lastDeploymentStatus: "",
      isCustomDomainOnly: false,
    });
    setIsInitialized(false);
    setViewInBlocksMonitor(true);
    /*
    setPreFilledFields({
      provider: false,
      region: false,
      selectedSpec: false,
    });
    */
    onClose();
  };

  const getButtonText = () => {
    if (isDeploymentFlow) {
      return isDeploying
        ? t("DEPLOYMENT_SETTINGS_MODAL.DEPLOYING")
        : t("DEPLOYMENT_SETTINGS_MODAL.DEPLOY_NOW");
    }
    return isPending
      ? t("DEPLOYMENT_SETTINGS_MODAL.SAVING")
      : t("DEPLOYMENT_SETTINGS_MODAL.SAVE_SETTINGS");
  };

  const isButtonDisabled = () => {
    if (isDeploymentFlow) {
      return !isFormValid() || isDeploying;
    }
    return !isFormValid() || isPending;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={
          isMobile
            ? "h-screen w-screen overflow-y-auto"
            : "max-h-[90vh] max-w-2xl overflow-y-auto"
        }>
        <DialogHeader>
          <DialogTitle className="text-left text-lg font-semibold">
            {isDeploymentFlow
              ? t("DEPLOYMENT_SETTINGS_MODAL.TITLE_FLOW")
              : t("DEPLOYMENT_SETTINGS_MODAL.TITLE_SETTINGS")}
          </DialogTitle>
          <DialogDescription className="text-left">
            {isDeploymentFlow
              ? t("DEPLOYMENT_SETTINGS_MODAL.DESCRIPTION_FLOW")
              : t("DEPLOYMENT_SETTINGS_MODAL.DESCRIPTION_SETTINGS")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <div className="w-full">
            <label className="mb-3 block text-sm font-medium">
              {t("DEPLOYMENT_SETTINGS_MODAL.DEPLOYMENT_TYPE")}
            </label>
            <RadioGroup
              value={deploymentData.deploymentType}
              onValueChange={(value) =>
                updateFormData("deploymentType", value as "auto" | "manual")
              }
              className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {DEPLOYMENT_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    checked={deploymentData.deploymentType === option.value}
                  />
                  <label htmlFor={option.value} className="text-sm">
                    {deploymentOptionLabels[option.value] ?? option.label}
                  </label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {showDomainOption && (
            <div className="w-full">
              <p
                id="domains-heading"
                className="mb-3 block text-sm font-medium">
                {t("DEPLOYMENT_SETTINGS_MODAL.DOMAINS")}
              </p>
              <RadioGroup
                aria-labelledby="domains-heading"
                value={deploymentData.isCustomDomainOnly ? "custom" : "both"}
                onValueChange={(value) =>
                  updateFormData("isCustomDomainOnly", value === "custom")
                }
                className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {DOMAIN_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={option.value}
                      id={`domains-${option.value}`}
                      checked={
                        (deploymentData.isCustomDomainOnly ? "custom" : "both") ===
                        option.value
                      }
                    />
                    <label
                      htmlFor={`domains-${option.value}`}
                      className="text-sm">
                      {domainOptionLabels[option.value] ?? option.label}
                    </label>
                  </div>
                ))}
              </RadioGroup>
              <p className="mt-2 text-xs text-low-emphasis">
                {t("DEPLOYMENT_SETTINGS_MODAL.DOMAINS_HINT")}
              </p>
            </div>
          )}

          {/* Only the first deployment (the deployment flow) offers this; the monitor is
              created once, right after the build is triggered. */}
          {isDeploymentFlow && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="view-in-blocks-monitor"
                checked={viewInBlocksMonitor}
                onCheckedChange={(checked) =>
                  setViewInBlocksMonitor(checked === true)
                }
              />
              <label htmlFor="view-in-blocks-monitor" className="text-sm">
                {t("DEPLOYMENT_SETTINGS_MODAL.VIEW_IN_MONITOR")}
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isButtonDisabled()}>
            {t("common:CANCEL")}
          </Button>
          <Button onClick={handleSave} disabled={isButtonDisabled()}>
            {getButtonText()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeploymentSettingsModal;
