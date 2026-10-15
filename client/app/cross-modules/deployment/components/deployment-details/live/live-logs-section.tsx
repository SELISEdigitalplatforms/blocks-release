/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { LogoLoader } from "@/components/loader-spinner/logo-loader";
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
import { LogLineText } from "@blocks-deployment/components/deployment-details/shared/log-line-text";
import { useNotificationListener } from "@/cross-modules/communication/hooks/use-notification-listener";
import { IDeploymentEvent } from "@blocks-deployment/pages/deployment-details";

interface LiveDeploymentLogsProps {
  buildId?: string;
  historicalEvents?: IDeploymentEvent[];
}

const LiveDeploymentLogs: React.FC<LiveDeploymentLogsProps> = ({ buildId, historicalEvents }) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [notificationSteps, setNotificationSteps] = useState<IBuildStep[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(true);
  const [hasLoadedHistorical, setHasLoadedHistorical] = useState<boolean>(false);
  const [completedBuilds, setCompletedBuilds] = useState<Set<string>>(new Set());
  const [failedBuilds, setFailedBuilds] = useState<Set<string>>(new Set());
  const [successfulSteps, setSuccessfulSteps] = useState<Set<string>>(new Set());

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

  // A different build starts from a clean slate. Done while rendering so the previous
  // build's steps are never painted under the new one.
  const [stepsBuildId, setStepsBuildId] = useState(buildId);
  if (stepsBuildId !== buildId) {
    setStepsBuildId(buildId);
    if (buildId) {
      setNotificationSteps([]);
      setHasLoadedHistorical(false);
      setIsLoadingHistorical(true);
      setCompletedBuilds(new Set());
      setFailedBuilds(new Set());
      setSuccessfulSteps(new Set());
    }
  }

  // Historical logs come from the build's persisted events (GET /api/build?buildId=),
  // which the page already fetches and passes in — no separate historical request.
  // Wait until the events are available; an empty array still counts as "loaded".
  if (buildId && !hasLoadedHistorical && historicalEvents) {
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
  }

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
        description: "Deployment failed. Please check the logs for more details.",
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
          deploymentMessage = JSON.parse(notificationData.message.denormalizedPayload).Message;
        } else {
          deploymentMessage = notificationData.message.denormalizedPayload.Message;
        }
      } catch (error) {
        console.error("Failed to parse notification data:", error);
        return;
      }

      if (buildId && deploymentMessage.BuildId !== buildId) {
        setExpandedSteps(new Set());
        return;
      }

      if (deploymentMessage.EventGroup === DeploymentEventGroup.Deploy) {
        if (deploymentMessage.EventType === DeploymentEventType.EventFinished) {
          showSuccessToast(deploymentMessage.BuildId);
        } else if (deploymentMessage.EventType === DeploymentEventType.EventFailed) {
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

        const isLogEvent = deploymentMessage.EventType === DeploymentEventType.Log;
        if (isLogEvent) {
          const stepId = `${deploymentMessage.BuildId}-${deploymentMessage.EventGroup}`;
          const existingStep = prevSteps.find(
            (step) => step.eventGroup === deploymentMessage.EventGroup,
          );

          if (existingStep && (!existingStep.logs || existingStep.logs.length === 0)) {
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

  if (!buildId || (isLoadingHistorical && logSteps.length === 0 && !hasLoadedHistorical)) {
    return (
      <section aria-label={title} className="mb-6 w-full min-w-0 space-y-2">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-high-emphasis">
          {title}
        </h2>
        <div className="w-full rounded-sm bg-card px-5 py-8 text-center text-muted-foreground shadow-surface-ring">
          <div className="mb-3 flex justify-center">
            <LogoLoader size={32} label="Loading deployment logs" />
          </div>
          <p>{!buildId ? "Waiting for build ID..." : "Loading deployment logs..."}</p>
        </div>
      </section>
    );
  }

  const isEmpty = logSteps.length === 0;

  // Same section as the finished-build view: header above, one card of step rows.
  return (
    <section aria-label={title} className="mb-6 w-full min-w-0 space-y-2">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-high-emphasis">
          {title}
        </h2>
      </header>
      <div className="w-full overflow-hidden rounded-sm bg-card shadow-surface-ring">
        {isEmpty && (
          <div className="px-5 py-8 text-center text-muted-foreground">
            <div className="mb-3 flex justify-center">
              <LogoLoader size={32} label="Loading deployment logs" />
            </div>
            <p>Loading deployment logs...</p>
          </div>
        )}

        {logSteps.map((step, stepIndex) => (
          <div
            key={step.id}
            className={`${stepIndex !== logSteps.length - 1 ? "border-default border-b" : ""}`}
          >
            <div
              role="button"
              tabIndex={0}
              className={`flex items-center justify-between bg-card px-5 py-3 transition-colors ${
                shouldShowChevron(step) ? "cursor-pointer hover:bg-primary/[0.04]" : ""
              }`}
              onClick={() => shouldShowChevron(step) && toggleExpanded(step.id)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (shouldShowChevron(step)) {
                  toggleExpanded(step.id);
                }
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  {shouldShowChevron(step) &&
                    (expandedSteps.has(step.id) ? (
                      <ChevronDown className="h-4 w-4 text-medium-emphasis" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-medium-emphasis" />
                    ))}
                  {memoizedStatusIcons.get(step.id) || getStatusIcon(step.status)}
                </div>
                <span className="text-sm font-medium">{step.name}</span>
              </div>
              {/* Always rendered: a step with no resolvable timing shows the
                  placeholder rather than silently dropping the column. */}
              <div
                className="font-mono text-xs text-low-emphasis"
                title={getStepTimingTooltip(step)}
              >
                {step.duration ?? DURATION_PLACEHOLDER}
              </div>
            </div>

            {expandedSteps.has(step.id) && step.logs && step.logs.length > 0 && (
              <div className="bg-card px-5 pb-4">
                <div className="overflow-hidden rounded-sm bg-log-surface ring-1 ring-log-border">
                  <StepTimingBar
                    step={step}
                    className="border-log-border bg-log-gutter text-log-muted"
                  />
                  <div className="overflow-x-auto py-1.5">
                    {step.logs.map((log, logIndex) => (
                      <div
                        key={logIndex}
                        className="flex font-mono text-xs leading-5 text-log-text hover:bg-white/[0.04]"
                      >
                        <div className="min-w-[3rem] shrink-0 select-none px-3 text-right text-log-muted">
                          {String(logIndex + 1).padStart(2, "0")}
                        </div>
                        <div className="flex-1 whitespace-pre-wrap break-all px-3 [&_span]:text-log-muted">
                          <LogLineText line={log} />
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
    </section>
  );
};

export default LiveDeploymentLogs;
