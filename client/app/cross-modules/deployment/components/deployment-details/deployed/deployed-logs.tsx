import React, { useState, useEffect } from "react";
import { Clock, ChevronDown, ChevronRight } from "lucide-react";
import { DeployedLogsService } from "@blocks-deployment/services/deployed-logs.service";
import {
  DEPLOYMENT_LOG_EVENT_STATUS,
  formatDuration,
  getPipelineTimeRange,
  getStepTimingTooltip,
} from "@blocks-deployment/utils/deployment-logs.utils";
import { IBuildStep } from "@blocks-deployment/models/live-logs";
import { StepTimingBar } from "@blocks-deployment/components/deployment-details/shared/step-timing-bar";
import { useStatusIcon } from "@blocks-deployment/hooks/use-log-status-icon";
import { IDeploymentPageData } from "@blocks-deployment/pages/deployment-details";

interface DeployedLogsProps {
  buildId?: string;
  logType?: string;
  cardData?: IDeploymentPageData;
  isLoading?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
}

const DeployedLogs: React.FC<DeployedLogsProps> = ({
  buildId,
  cardData,
  isLoading,
  isError,
  isSuccess,
}) => {
  const { getStatusIcon } = useStatusIcon();

  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [buildSteps, setBuildSteps] = useState<IBuildStep[]>([]);
  const [wholeDeploymentStatus, setWholeDeploymentStatus] = useState<string>();

  useEffect(() => {
    if (isSuccess && cardData?.events) {
      const steps: IBuildStep[] = DeployedLogsService.processEventsToSteps(
        cardData?.events,
        buildId ?? "",
      );
      setBuildSteps(steps);

      const defaultExpanded: Set<string> =
        DeployedLogsService.getDefaultExpandedSteps(steps);
      setExpandedSteps(defaultExpanded);
    }

    if (
      cardData?.status === DEPLOYMENT_LOG_EVENT_STATUS.COMPLETED ||
      cardData?.status === DEPLOYMENT_LOG_EVENT_STATUS.SUCCESS
    ) {
      setWholeDeploymentStatus("Successful");
    } else if (cardData?.status === DEPLOYMENT_LOG_EVENT_STATUS.FAILED) {
      setWholeDeploymentStatus("Failed");
    }
  }, [isSuccess, cardData, buildId]);

  const title: string = "Deployment logs";

  const toggleExpanded = (stepId: string): void => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  if (isError) {
    return (
      <div className="mx-auto w-full">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold">{title}</h2>
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <div className="flex items-center">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600">
                <span className="text-xs text-white">✕</span>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-red-800">
                  Failed to load deployment data
                </h3>
                <h4 className="text-sm font-medium text-red-800">
                  Unable to show deployment logs
                </h4>
                <p className="mt-1 text-xs text-red-600">
                  Build ID: {buildId || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Wall clock across the whole pipeline, not the sum of the steps: steps can
  // overlap, and the gaps between them are real time the build took.
  const pipelineRange = getPipelineTimeRange(buildSteps);
  const pipelineDuration = pipelineRange
    ? formatDuration(pipelineRange.endMs - pipelineRange.startMs)
    : "";

  if (!buildId || isLoading || buildSteps.length === 0) {
    return (
      <div className="mx-auto w-full bg-background">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold">{title}</h2>
          <div className="py-8 text-center text-gray-500">
            <Clock className="mx-auto mb-2 h-8 w-8 animate-spin" />
            <p>
              {!buildId
                ? "Waiting for build ID..."
                : "Loading deployment logs..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-default mb-6 flex h-auto w-full flex-col items-start justify-center gap-4 self-stretch rounded-sm border bg-background p-6 shadow-sm">
      <div className="w-full">
        <div>
          {/* Header - Desktop view */}
          <div className="mb-6 hidden md:flex md:items-center md:justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="flex items-center gap-2">
              {getStatusIcon(wholeDeploymentStatus ?? "")}
              <p className="text-sm text-gray-600">
                {wholeDeploymentStatus} at {cardData?.eventName}
                {pipelineDuration ? ` · ${pipelineDuration}` : ""}
              </p>
            </div>
          </div>

          {/* Header - Mobile view */}
          <div className="mb-6 md:hidden">
            <h2 className="mb-3 text-lg font-semibold">{title}</h2>
            <div className="flex items-center gap-2">
              {getStatusIcon(wholeDeploymentStatus ?? "")}
              <p className="text-sm text-gray-600">
                {wholeDeploymentStatus} at {cardData?.eventName}
                {pipelineDuration ? ` · ${pipelineDuration}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="border-default w-full space-y-0 overflow-hidden rounded-md border">
          {buildSteps.map((step: IBuildStep, stepIndex: number) => (
            <div
              key={step.id}
              className={`${stepIndex !== buildSteps.length - 1 ? "border-default border-b" : ""}`}>
              {/* Step Header */}
              <div
                role="button"
                tabIndex={0}
                className={`flex items-center justify-between bg-background p-3 transition-colors ${
                  DeployedLogsService.shouldShowChevron(step)
                    ? "cursor-pointer hover:bg-secondary"
                    : ""
                }`}
                onClick={() =>
                  DeployedLogsService.shouldShowChevron(step) &&
                  toggleExpanded(step.id)
                }
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  if (DeployedLogsService.shouldShowChevron(step)) {
                    toggleExpanded(step.id);
                  }
                }}>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {DeployedLogsService.shouldShowChevron(step) &&
                      (expandedSteps.has(step.id) ? (
                        <ChevronDown className="h-4 w-4 text-medium-emphasis" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-medium-emphasis" />
                      ))}
                    {getStatusIcon(step.status)}
                  </div>
                  <span className="text-sm font-medium">
                    {step.name === "Sast" || step.name === "Sca"
                      ? step.name.toUpperCase()
                      : step.name}
                  </span>
                </div>
                <div
                  className="font-mono text-xs text-low-emphasis"
                  title={getStepTimingTooltip(step)}>
                  {step.duration}
                </div>
              </div>

              {/* Step Logs */}
              {expandedSteps.has(step.id) &&
                step.logs &&
                step.logs.length > 0 && (
                  <div className="bg-gray-100">
                    <StepTimingBar step={step} />
                    <div className="overflow-x-auto">
                      <div className="p-0">
                        {step.logs.map((log: string, logIndex: number) => (
                          <div
                            key={logIndex}
                            className="flex bg-secondary font-mono text-xs last:border-b-0">
                            <div className="min-w-[3rem] select-none bg-secondary px-3 py-1 text-right">
                              {String(logIndex + 1).padStart(2, "0")}
                            </div>
                            <div className="flex-1 px-3 py-1">{log}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DeployedLogs;
