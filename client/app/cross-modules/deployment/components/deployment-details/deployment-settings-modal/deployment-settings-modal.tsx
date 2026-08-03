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
import {
  useUpdateRepoSettings,
  useGetRepoDetails,
  useGetSpecs,
} from "@/cross-modules/deployment/hooks/use-github-info";
import { toast } from "@/hooks/use-toast";
import { DEPLOYMENT_OPTIONS } from "@blocks-deployment/models/deployment-settings";
import useIsMobile from "@/hooks/use-is-mobile";
import { useProjectStore } from "@/store/project.store";
import { useNavigate } from "react-router";
import { useScopedPath } from "@/hooks/use-scoped-path";

interface IDeploymentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoId: string;
  isDeploymentFlow?: boolean;
  onDeploy?: (deploymentData: DeploymentFormData) => void;
  isDeploying?: boolean;
}

const DeploymentSettingsModal = ({
  isOpen,
  onClose,
  repoId,
  isDeploymentFlow = false,
  onDeploy,
  isDeploying = false,
}: IDeploymentSettingsModalProps) => {
  const navigate = useNavigate();
  const scoped = useScopedPath();

  const projectEnvironment =
    useProjectStore().selectedProject?.environment || "";
  const projectName = useProjectStore().selectedProject?.name || "";

  const isMobile = useIsMobile();
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
  });
  const [isInitialized, setIsInitialized] = useState(false);

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
  } = useGetRepoDetails(repoId);
  const { data: specs, isLoading: isSpecsLoading } = useGetSpecs() as any;
  const { mutate: updateRepoSettings, isPending } = useUpdateRepoSettings({
    onSuccess: () => {
      toast({
        title: "Settings",
        description: "Settings updated successfully",
        variant: "success",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Settings",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });
  const specsData = specs?.data;

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
      });

      setIsInitialized(true);
    }
  }, [isOpen, repoDetails, specsData, isInitialized, isSpecsLoading]);

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
        onDeploy(deploymentData);
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
    });
    setIsInitialized(false);
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
      return isDeploying ? "Deploying..." : "Deploy Now";
    }
    return isPending ? "Saving..." : "Save Settings";
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
            {isDeploymentFlow ? "Configure Deployment" : "Deployment Settings"}
          </DialogTitle>
          <DialogDescription className="text-left">
            {isDeploymentFlow
              ? "Configure your deployment settings and deploy your repository."
              : "Configure your deployment settings including hosting provider, region, and machine specifications."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <div className="w-full">
            <label className="mb-3 block text-sm font-medium">
              Deployment Type
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
                    {option.label}
                  </label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isButtonDisabled()}>
            Cancel
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
