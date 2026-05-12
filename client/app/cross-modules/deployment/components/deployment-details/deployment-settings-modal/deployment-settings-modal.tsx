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
  useChangeRepoSpecs,
  useGetRepoDetails,
  useGetSpecs,
} from "@/cross-modules/deployment/hooks/use-github-info";
import { toast } from "@/hooks/use-toast";
import { DEPLOYMENT_OPTIONS } from "@blocks-deployment/models/deployment-settings";
import useIsMobile from "@/hooks/use-is-mobile";
import { useProjectStore } from "@/store/useProjectStore";
import { useNavigate } from "react-router-dom";

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

  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const projectEnvironment =
    useProjectStore().selectedProject?.environment || "";
  const projectName = useProjectStore().selectedProject?.name || "";

  const isMobile = useIsMobile();
  const [deploymentData, setDeploymentData] = useState<DeploymentFormData>({
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
    refetch: refetchRepoDetails,
  } = useGetRepoDetails(projectKey, repoId);
  const { data: specs, isLoading: isSpecsLoading } = useGetSpecs() as any;
  const { mutate: changeRepoSpecs, isPending } = useChangeRepoSpecs();
  const specsData = specs?.data;

  useEffect(() => {
    if (isError && error && typeof error === "object" && "errors" in error) {
      const httpError = error as IHttpError;
      const errorResponse = httpError.errors;

      if (
        errorResponse.data?.repo === null &&
        errorResponse.isSuccess === false
      ) {
        navigate("/deployment");
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
      });

      /*
      const hasPreFilledProvider = !!preselectedDeploySettings?.hostingProvider?.name;
      const hasPreFilledRegion = !!preselectedDeploySettings?.region?.name;
      const hasPreFilledSpec = !!preselectedDeploySettings?.machineConfig?.id;

      setPreFilledFields({
        provider: hasPreFilledProvider,
        region: hasPreFilledRegion,
        selectedSpec: hasPreFilledSpec,
      });
      */

      setIsInitialized(true);
    }
  }, [isOpen, repoDetails, specsData, isInitialized, isSpecsLoading]);

  const updateFormData = <K extends keyof DeploymentFormData>(
    field: K,
    value: DeploymentFormData[K],
  ) => {
    setDeploymentData((prev) => ({ ...prev, [field]: value }));
  };

  /*
  const updateFormDataFull = <K extends keyof DeploymentFormData>(
    field: K,
    value: DeploymentFormData[K],
  ) => {
    const newData = { ...deploymentData };
    if (field === "provider") {
      newData.provider = value as string;
      newData.region = "";
      newData.selectedSpec = "";
      const selectedProvider = (Array.isArray(specsData) ? specsData : [])?.find(
        (p) => p.name === value,
      );
      newData.providerId = selectedProvider?.id || "";
      newData.regionId = "";
      newData.machineConfigId = "";

      setPreFilledFields((prev) => ({
        ...prev,
        provider: false,
        region: false,
        selectedSpec: false,
      }));
    } else if (field === "region") {
      newData[field] = value;
      newData.selectedSpec = "";
      const selectedProvider = (Array.isArray(specsData) ? specsData : [])?.find(
        (p) => p.name === deploymentData.provider,
      );
      const selectedRegion = selectedProvider?.region?.find(
        (r: { name: string }) => r.name === value,
      );
      newData.regionId = selectedRegion?.id || "";
      newData.machineConfigId = "";

      setPreFilledFields((prev) => ({ ...prev, region: false, selectedSpec: false }));
    } else if (field === "selectedSpec") {
      newData[field] = value;
      const selectedProvider = (Array.isArray(specsData) ? specsData : [])?.find(
        (p) => p.name === deploymentData.provider,
      );

      const selectedRegion = selectedProvider?.region?.find(
        (r: IRegion) => r.name === deploymentData.region,
      );
      const selectedSpec = selectedRegion?.machineSpecs?.find(
        (s: IMachineSpec) => (s.id || `spec-${selectedRegion.machineSpecs?.indexOf(s)}`) === value,
      );
      newData.machineConfigId = selectedSpec?.id || "";

      setPreFilledFields((prev) => ({ ...prev, selectedSpec: false }));
    } else {
      newData[field] = value;
    }
    setDeploymentData(newData);
  };

  const activeProviders = (Array.isArray(specsData) ? specsData : []).filter(
    (provider) => provider.status === "active",
  );

  const selectedProviderRegions: IRegion[] =
    (Array.isArray(specsData)
      ? specsData.find((provider) => provider.name === deploymentData.provider)
      : undefined
    )?.region?.filter((region: IRegion) => region.status === "active") || [];

  const getRegionMachineSpecs = () => {
    if (!deploymentData.region) {
      return [];
    }

    const selectedRegion = selectedProviderRegions.find(
      (region: IRegion) => region.name === deploymentData.region,
    );

    if (!selectedRegion?.machineSpecs) {
      return [];
    }

    return selectedRegion.machineSpecs.filter((spec: IMachineSpec) => spec.status === "active");
  };

  const availableMachineSpecs = getRegionMachineSpecs();
  */

  const isFormValid = () => {
    return !!(
      deploymentData.providerId &&
      deploymentData.regionId &&
      deploymentData.machineConfigId
    );
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
        hostingProviderId: deploymentData.providerId,
        regionId: deploymentData.regionId,
        machineConfigId: deploymentData.machineConfigId,
        deploymentType: deploymentData.deploymentType,
        projectKey: projectKey,
        projectEnv: projectEnvironment,
        projectName: projectName,
      };

      (changeRepoSpecs as any)(payload, {
        onSuccess: () => {
          refetchRepoDetails();
          toast({
            title: "Settings",
            description: "Settings updated successfully",
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

          {/*
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Hosting Provider</label>
              {preFilledFields.provider ? (
                <div className="flex w-full cursor-not-allowed items-center justify-between rounded-md border border-blocks-primary-shades-300 bg-background px-3 py-2 opacity-50">
                  <span>{deploymentData.provider || "Select a provider"}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex w-full items-center justify-between rounded-md border border-blocks-primary-shades-300 bg-background px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary">
                      <span>{deploymentData.provider || "Select a provider"}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="min-w-[var(--radix-dropdown-menu-trigger-width)]">
                    {activeProviders.map((provider) => (
                      <DropdownMenuItem
                        key={provider.id}
                        onClick={() => updateFormData("provider", provider.name)}
                      >
                        {provider.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Region</label>
              {!deploymentData.provider || preFilledFields.provider || preFilledFields.region ? (
                <div className="flex w-full cursor-not-allowed items-center justify-between rounded-md border border-blocks-primary-shades-300 bg-background px-3 py-2 opacity-50">
                  <span>{deploymentData.region || "Select a region"}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex w-full items-center justify-between rounded-md border border-blocks-primary-shades-300 bg-background px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary">
                      <span>{deploymentData.region || "Select a region"}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="min-w-[var(--radix-dropdown-menu-trigger-width)]">
                    {selectedProviderRegions.map((region: IRegion) => (
                      <DropdownMenuItem
                        key={region.name}
                        onClick={() => updateFormData("region", region.name)}
                      >
                        {region.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="w-full">
            <label className="mb-4 block text-sm font-medium">Select Specification</label>
            {!deploymentData.region ? (
              <div className="rounded-md border bg-secondary p-4 text-center text-gray-500">
                Please select a region first to view available specifications
              </div>
            ) : availableMachineSpecs.length === 0 ? (
              <div className="rounded-md border bg-secondary p-4 text-center text-gray-500">
                No specifications available for the selected region
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {availableMachineSpecs.map((spec: IMachineSpec, index: number) => (
                  <SpecificationOption
                    key={spec.id || `spec-${index}`}
                    ram={spec.ram}
                    cpu={spec.cpu}
                    bandwidth={spec.bandwidth}
                    id={spec.id || `spec-${index}`}
                    isSelected={deploymentData.selectedSpec === (spec.id || `spec-${index}`)}
                    onClick={() => updateFormData("selectedSpec", spec.id || `spec-${index}`)}
                  />
                ))}
              </div>
            )}
          </div>
          */}
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
