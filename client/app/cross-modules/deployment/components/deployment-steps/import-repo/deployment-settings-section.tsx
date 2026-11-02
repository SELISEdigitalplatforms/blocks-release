/* eslint-disable @typescript-eslint/no-explicit-any */

import { DEPLOYMENT_OPTIONS } from "@blocks-deployment/models/git-dummy";
import { DeploymentFormData } from "@blocks-deployment/models/github-info";
import { ChevronDown } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { SpecificationButton } from "./helpers/specifications";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui-kits/radio-group/radio-group";
import { IProvider } from "@blocks-deployment/models/deployment-settings";

interface IDeploymentSettingsProps {
  selectedRepo: string | null;
  selectedBranch: string | null;
  specsData: IProvider[] | undefined;
  deploymentData: DeploymentFormData;
  onDeploymentDataChange: (data: DeploymentFormData) => void;
}

const DeploymentSettingSection = ({
  specsData,
  deploymentData,
  onDeploymentDataChange,
}: IDeploymentSettingsProps) => {
  const { t } = useT("release.deployment.shared");
  const updateFormData = <K extends keyof DeploymentFormData>(
    field: K,
    value: DeploymentFormData[K],
  ) => {
    const newData = { ...deploymentData };
    if (field === "provider") {
      newData.provider = value as string;
      newData.region = "";
      newData.selectedSpec = "";
      const selectedProvider = specsData?.find((p) => p.name === value);
      newData.providerId = selectedProvider?.id || "";
      newData.regionId = "";
      newData.machineConfigId = "";
    } else if (field === "region") {
      newData[field] = value;
      newData.selectedSpec = "";
      const selectedProvider = specsData?.find(
        (p) => p.name === deploymentData.provider,
      );
      const selectedRegion = selectedProvider?.region?.find(
        (r) => r.name === value,
      );
      newData.regionId = selectedRegion?.id || "";
      newData.machineConfigId = "";
    } else if (field === "selectedSpec") {
      newData[field] = value;
      const selectedProvider = specsData?.find(
        (p) => p.name === deploymentData.provider,
      );
      const selectedRegion = selectedProvider?.region?.find(
        (r) => r.name === deploymentData.region,
      );
      const selectedSpec = selectedRegion?.machineSpecs?.find(
        (s) =>
          (s.id || `spec-${selectedRegion.machineSpecs.indexOf(s)}`) === value,
      );
      newData.machineConfigId = selectedSpec?.id || "";
    } else {
      newData[field] = value;
    }
    onDeploymentDataChange(newData);
  };

  const activeProviders =
    specsData?.filter((provider) => provider.status === "active") || [];

  const selectedProviderRegions =
    specsData
      ?.find((provider) => provider.name === deploymentData.provider)
      ?.region?.filter((region) => region.status === "active") || [];

  const getRegionMachineSpecs = () => {
    if (!deploymentData.region) {
      return [];
    }

    const selectedRegion = selectedProviderRegions.find(
      (region) => region.name === deploymentData.region,
    );

    if (!selectedRegion?.machineSpecs) {
      return [];
    }

    return selectedRegion.machineSpecs.filter(
      (spec) => spec.status === "active",
    );
  };

  const availableMachineSpecs = getRegionMachineSpecs();

  let specsMessage: { className: string; text: string } | null = null;
  if (!deploymentData.region) {
    specsMessage = {
      className:
        "rounded-md border border-blocks-primary-shades-300 bg-secondary p-4 text-center text-medium-emphasis",
      text: t("DEPLOYMENT_SETTINGS_SECTION.SELECT_REGION_FIRST"),
    };
  } else if (availableMachineSpecs.length === 0) {
    specsMessage = {
      className:
        "rounded-md border border-blocks-primary-shades-300 bg-gray-50 p-4 text-center text-medium-emphasis",
      text: t("DEPLOYMENT_SETTINGS_SECTION.NO_SPECIFICATIONS"),
    };
  }

  return (
    <div className="flex w-full flex-col items-start rounded-sm border border-border-default bg-background p-5">
      <h3 className="mb-6 text-lg font-semibold">{t("DEPLOYMENT_SETTINGS_SECTION.TITLE")}</h3>

      <div className="w-full space-y-6">
        <div className="w-full max-w-lg">
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
                  disabled={option.value === "manual"}
                />
                <label htmlFor={option.value}>{option.label}</label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 md:max-w-2xl md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {t("DEPLOYMENT_SETTINGS_SECTION.HOSTING_PROVIDER")}
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-md border border-blocks-primary-shades-300 bg-background px-3 py-2 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary">
                  <span className="truncate">
                    {deploymentData.provider ||
                      t("DEPLOYMENT_SETTINGS_SECTION.SELECT_PROVIDER")}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-(--radix-dropdown-menu-trigger-width)">
                {activeProviders.map((provider) => (
                  <DropdownMenuItem
                    key={provider.id}
                    onClick={() => updateFormData("provider", provider.name)}>
                    {provider.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">{t("DEPLOYMENT_SETTINGS_SECTION.REGION")}</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex w-full items-center justify-between rounded-md border border-blocks-primary-shades-300 bg-background px-3 py-2 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!deploymentData.provider}>
                  <span className="truncate">
                    {deploymentData.region ||
                      t("DEPLOYMENT_SETTINGS_SECTION.SELECT_REGION")}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-(--radix-dropdown-menu-trigger-width)">
                {selectedProviderRegions.map((region) => (
                  <DropdownMenuItem
                    key={region.name}
                    onClick={() => updateFormData("region", region.name)}>
                    {region.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="w-full">
          <label className="mb-4 block text-sm font-medium">
            {t("DEPLOYMENT_SETTINGS_SECTION.SELECT_SPECIFICATION")}
          </label>
          {specsMessage ? (
            <div className={specsMessage.className}>{specsMessage.text}</div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {availableMachineSpecs.map((spec, index) => (
                <SpecificationButton
                  key={spec.id || `spec-${index}`}
                  ram={spec.ram}
                  cpu={spec.cpu}
                  bandwidth={spec.bandwidth}
                  id={spec.id || `spec-${index}`}
                  isSelected={
                    deploymentData.selectedSpec === (spec.id || `spec-${index}`)
                  }
                  onClick={() =>
                    updateFormData("selectedSpec", spec.id || `spec-${index}`)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeploymentSettingSection;
