/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Clock, ChevronDown, ChevronRight } from "lucide-react";
import {
  DeploymentEventGroup,
  DeploymentEventType,
  IBuildStep,
  IDeploymentLogsDenormalizedPayload,
  NotificationData,
} from "@blocks-deployment/models/live-logs";
import { toast } from "@/hooks/use-toast";
import { useStatusIcon } from "@blocks-deployment/hooks/use-log-status-icon";
import { LiveLogsService } from "@blocks-deployment/services/live-logs.service";
import {
  DURATION_PLACEHOLDER,
  getStepTimingTooltip,
} from "@blocks-deployment/utils/deployment-logs.utils";
import { StepTimingBar } from "@blocks-deployment/components/deployment-details/shared/step-timing-bar";
import { useNotificationListener } from "@/cross-modules/communication/hooks/use-notification-listener";
import { IDeploymentEvent } from "@blocks-deployment/pages/deployment-details";

interface LiveDeploymentLogsProps {
  buildId?: string;
  historicalEvents?: IDeploymentEvent[];
}

const LiveDeploymentLogs: React.FC<LiveDeploymentLogsProps> = ({
  buildId,
  historicalEvents,
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [notificationSteps, setNotificationSteps] = useState<IBuildStep[]>([]);
  const [, setHasIncorrectBuildId] = useState<boolean>(false);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(true);
  const [hasLoadedHistorical, setHasLoadedHistorical] =
    useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const [completedBuilds, setCompletedBuilds] = useState<Set<string>>(
    new Set(),
  );
  const [failedBuilds, setFailedBuilds] = useState<Set<string>>(new Set());
  const [successfulSteps, setSuccessfulSteps] = useState<Set<string>>(
    new Set(),
  );

  const { getStatusIcon } = useStatusIcon();

  const memoizedStatusIcons = useMemo(() => {
    const iconMap = new Map();

    notificationSteps.forEach((step) => {
      if (!iconMap.has(step.id)) {
        if (successfulSteps.has(step.id)) {
          iconMap.set(step.id, getStatusIcon("success"));
        } else {
          const currentIcon = getStatusIcon(step.status);
          iconMap.set(step.id, currentIcon);

          if (step.status === "success") {
            setSuccessfulSteps((prev) => new Set(prev).add(step.id));
          }
        }
      }
    });

    return iconMap;
  }, [notificationSteps, getStatusIcon, successfulSteps]);

  useEffect(() => {
    if (buildId) {
      setHasIncorrectBuildId(false);
      setNotificationSteps([]);
      setHasLoadedHistorical(false);
      setIsLoadingHistorical(true);
      setConnectionStatus("disconnected");
      setCompletedBuilds(new Set());
      setFailedBuilds(new Set());
      setSuccessfulSteps(new Set());
    }
  }, [buildId]);

  useEffect(() => {
    // Historical logs come from the build's persisted events (GET /api/build?buildId=),
    // which the page already fetches and passes in — no separate historical request.
    // Wait until the events are available; an empty array still counts as "loaded".
    if (!buildId || hasLoadedHistorical || !historicalEvents) return;

    setIsLoadingHistorical(true);

    // processHistoricalLogs expects PascalCase keys; the build events are camelCase.
    const mappedLogs = historicalEvents.map((event) => ({
      BuildId: event.buildId,
      EventGroup: event.eventGroup,
      EventType: event.eventType,
      Message: event.message,
      CreatedAt: event.createdAt,
    }));

    if (mappedLogs.length > 0) {
      const processedSteps = LiveLogsService.processHistoricalLogs(mappedLogs);
      setNotificationSteps(processedSteps);

      processedSteps.forEach((step) => {
        if (step.status === "success") {
          setSuccessfulSteps((prev) => new Set(prev).add(step.id));
        }
      });
    }

    setHasLoadedHistorical(true);
    setIsLoadingHistorical(false);
  }, [buildId, hasLoadedHistorical, historicalEvents]);

  const showSuccessToast = (buildId: string) => {
    if (!completedBuilds.has(buildId)) {
      toast({
        title: "Deployment Status",
        description: "Successfully deployed",
        variant: "success",
      });
      setCompletedBuilds((prev) => new Set(prev).add(buildId));
    }
  };

  const showErrorToast = (buildId: string) => {
    if (!failedBuilds.has(buildId)) {
      toast({
        title: "Deployment Failed",
        description:
          "Deployment failed. Please check the logs for more details.",
        variant: "destructive",
      });
      setFailedBuilds((prev) => new Set(prev).add(buildId));
    }
  };

  const handleNotificationData = useCallback(
    (notificationData: NotificationData) => {
      let deploymentMessage: IDeploymentLogsDenormalizedPayload;

      try {
        if (typeof notificationData.message.denormalizedPayload === "string") {
          deploymentMessage = JSON.parse(
            notificationData.message.denormalizedPayload,
          ).Message;
        } else {
          deploymentMessage =
            notificationData.message.denormalizedPayload.Message;
        }
      } catch (error) {
        console.error("Failed to parse notification data:", error);
        return;
      }

      if (buildId && deploymentMessage.BuildId !== buildId) {
        setHasIncorrectBuildId(true);
        setExpandedSteps(new Set());
        return;
      }

      setHasIncorrectBuildId(false);
      setConnectionStatus("connected");

      if (deploymentMessage.EventGroup === DeploymentEventGroup.Deploy) {
        if (deploymentMessage.EventType === DeploymentEventType.EventFinished) {
          showSuccessToast(deploymentMessage.BuildId);
        } else if (
          deploymentMessage.EventType === DeploymentEventType.EventFailed
        ) {
          showErrorToast(deploymentMessage.BuildId);
        }
      }

      setNotificationSteps((prevSteps) => {
        const updatedSteps = LiveLogsService.updateStepWithNotification(
          prevSteps,
          deploymentMessage,
        );

        updatedSteps.forEach((step) => {
          if (step.status === "success" && !successfulSteps.has(step.id)) {
            setSuccessfulSteps((prev) => new Set(prev).add(step.id));
          }
        });

        const isLogEvent =
          deploymentMessage.EventType === DeploymentEventType.Log;
        if (isLogEvent) {
          const stepId = `${deploymentMessage.BuildId}-${deploymentMessage.EventGroup}`;
          const existingStep = prevSteps.find(
            (step) => step.eventGroup === deploymentMessage.EventGroup,
          );

          if (
            existingStep &&
            (!existingStep.logs || existingStep.logs.length === 0)
          ) {
            setExpandedSteps((prev) => new Set(prev).add(existingStep.id));
          } else if (!existingStep) {
            setExpandedSteps((prev) => new Set(prev).add(stepId));
          }
        }

        return updatedSteps;
      });
    },
    [buildId, completedBuilds, failedBuilds, successfulSteps],
  );

  useNotificationListener("BuildLogNotification", handleNotificationData);

  useEffect(() => {
    let connectionTimer: NodeJS.Timeout;

    if (buildId) {
      setConnectionStatus("connecting");

      connectionTimer = setTimeout(() => {
        if (connectionStatus === "connecting") {
          setConnectionStatus("connected");
        }
      }, 3000);
    }

    return () => {
      if (connectionTimer) {
        clearTimeout(connectionTimer);
      }
    };
  }, [buildId]);

  useEffect(() => {
    if (notificationSteps.length > 0 && connectionStatus !== "connected") {
      setConnectionStatus("connected");
    }
  }, [notificationSteps, connectionStatus]);

  const title = "Deployment logs";
  const logSteps = notificationSteps;

  const toggleExpanded = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const shouldShowChevron = (step: IBuildStep) => {
    return step.logs && step.logs.length > 0;
  };

  if (
    !buildId ||
    (isLoadingHistorical && logSteps.length === 0 && !hasLoadedHistorical)
  ) {
    return (
      <div className="mx-auto w-full rounded-lg border border-border bg-background">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-high-emphasis">
              {title}
            </h2>
          </div>
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
    <div className="mx-auto mb-6 w-full rounded-lg border border-border bg-background">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-high-emphasis">{title}</h2>
        </div>

        {logSteps.length === 0 &&
          isLoadingHistorical &&
          !hasLoadedHistorical && (
            <div className="py-8 text-center text-gray-500">
              <Clock className="mx-auto mb-2 h-8 w-8 animate-spin" />
              <p>Loading deployment logs...</p>
            </div>
          )}

        {logSteps.length === 0 &&
          (!isLoadingHistorical || hasLoadedHistorical) && (
            <div className="py-8 text-center text-gray-500">
              <Clock className="mx-auto mb-2 h-8 w-8 animate-spin" />
              <p>Loading deployment logs...</p>
            </div>
          )}

        {logSteps.length > 0 && (
          <div className="border-default space-y-0 overflow-hidden rounded-md border">
            {logSteps.map((step, stepIndex) => (
              <div
                key={step.id}
                className={`${stepIndex !== logSteps.length - 1 ? "border-default border-b" : ""}`}>
                <div
                  role="button"
                  tabIndex={0}
                  className={`flex items-center justify-between bg-background p-3 transition-colors ${
                    shouldShowChevron(step)
                      ? "cursor-pointer hover:bg-secondary"
                      : ""
                  }`}
                  onClick={() =>
                    shouldShowChevron(step) && toggleExpanded(step.id)
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    if (shouldShowChevron(step)) {
                      toggleExpanded(step.id);
                    }
                  }}>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {shouldShowChevron(step) &&
                        (expandedSteps.has(step.id) ? (
                          <ChevronDown className="h-4 w-4 text-medium-emphasis" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-medium-emphasis" />
                        ))}
                      {memoizedStatusIcons.get(step.id) ||
                        getStatusIcon(step.status)}
                    </div>
                    <span className="text-sm font-medium">{step.name}</span>
                  </div>
                  {/* Always rendered: a step with no resolvable timing shows the
                      placeholder rather than silently dropping the column. */}
                  <div
                    className="font-mono text-xs text-low-emphasis"
                    title={getStepTimingTooltip(step)}>
                    {step.duration ?? DURATION_PLACEHOLDER}
                  </div>
                </div>

                {expandedSteps.has(step.id) &&
                  step.logs &&
                  step.logs.length > 0 && (
                    <div className="bg-secondary">
                      <StepTimingBar step={step} />
                      <div className="overflow-x-auto">
                        <div className="p-0">
                          {step.logs.map((log, logIndex) => (
                            <div
                              key={logIndex}
                              className="flex bg-secondary font-mono text-xs last:border-b-0">
                              <div className="min-w-[3rem] select-none bg-secondary px-3 py-1 text-right text-medium-emphasis">
                                {String(logIndex + 1).padStart(2, "0")}
                              </div>
                              <div className="flex-1 px-3 py-1">
                                {log.trim()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveDeploymentLogs;
