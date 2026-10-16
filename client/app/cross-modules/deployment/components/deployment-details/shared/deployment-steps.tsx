import { useMemo } from "react";
import {
  Check,
  FolderGit2,
  Loader2,
  Network,
  Package,
  Rocket,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { DeployedLogsService } from "@blocks-deployment/services/deployed-logs.service";
import { DURATION_PLACEHOLDER } from "@blocks-deployment/utils/deployment-logs.utils";
import { IBuildEvent } from "@blocks-deployment/models/deployed-logs";
import { DeploymentEventGroup, IBuildStep } from "@blocks-deployment/models/live-logs";
import { IPipelineEvent } from "@blocks-deployment/pages/repo-details";
import { cn } from "@/lib/utils";

type StepStatus = IBuildStep["status"];

/**
 * Every stage the pipeline runs, in order. Each gets its own icon and accent so the
 * strip reads at a glance - the colour names the stage, the corner badge its outcome.
 */
const PIPELINE_STEPS: {
  group: DeploymentEventGroup;
  label: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  {
    group: DeploymentEventGroup.Clone,
    label: "Clone",
    icon: FolderGit2,
    tone: "bg-primary/[0.07] text-primary",
  },
  {
    group: DeploymentEventGroup.Build,
    label: "Build",
    icon: Package,
    tone: "bg-sunset-soft text-warn-ink",
  },
  {
    group: DeploymentEventGroup.Sast,
    label: "SAST",
    icon: ShieldCheck,
    tone: "bg-lavender-soft text-lavender-ink",
  },
  {
    group: DeploymentEventGroup.Sca,
    label: "SCA",
    icon: Network,
    tone: "bg-rose-soft text-rose-ink",
  },
  {
    group: DeploymentEventGroup.Deploy,
    label: "Deploy",
    icon: Rocket,
    tone: "bg-forest-soft text-forest-ink",
  },
];

const STATUS_LABEL: Record<StepStatus, string> = {
  success: "succeeded",
  error: "failed",
  running: "running",
  pending: "not started",
};

const StatusBadge = ({ status }: { status: StepStatus }) => {
  if (status === "pending") return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full ring-1 ring-card",
        status === "success" && "bg-success text-white",
        status === "error" && "bg-error text-white",
        status === "running" && "bg-card text-primary",
      )}
    >
      {status === "success" && <Check className="h-2 w-2" strokeWidth={4} />}
      {status === "error" && <X className="h-2 w-2" strokeWidth={4} />}
      {status === "running" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
    </span>
  );
};

const useBuildSteps = (buildId: string, events: IPipelineEvent[]) =>
  useMemo(() => {
    if (!events?.length) return null;
    // Same event shape the logs page reads; only the enums are typed looser here.
    const processed = DeployedLogsService.processEventsToSteps(
      events as unknown as IBuildEvent[],
      buildId,
    );
    return new Map(processed.map((step) => [step.eventGroup, step]));
  }, [events, buildId]);

/**
 * A build's own icon: the stage it reached, in that stage's colours - where it failed,
 * else what is running, else the last stage that reported. Deploy when nothing did.
 */
export const BuildStageIcon = ({
  buildId,
  events,
}: {
  buildId: string;
  events: IPipelineEvent[];
}) => {
  const steps = useBuildSteps(buildId, events);
  const reported = PIPELINE_STEPS.filter(({ group }) => steps?.has(group));
  const stage =
    reported.find(({ group }) => steps?.get(group)?.status === "error") ??
    reported.find(({ group }) => steps?.get(group)?.status === "running") ??
    reported[reported.length - 1] ??
    PIPELINE_STEPS[PIPELINE_STEPS.length - 1];
  const Icon = stage.icon;
  return (
    <span
      className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px]", stage.tone)}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
};

/**
 * The pipeline stages of one build as a strip of coloured icons, each with its name and
 * duration. Stages that have not reported yet stay muted, so a running build shows how
 * far it has got and a failed one where it stopped. Renders nothing when the build
 * carries no step events.
 */
const DeploymentSteps = ({ buildId, events }: { buildId: string; events: IPipelineEvent[] }) => {
  const steps = useBuildSteps(buildId, events);

  if (!steps?.size) return null;

  return (
    // Each label is centred under its tile in a fixed-width column; the negative margin
    // pulls the first tile flush with the text above it.
    <ol aria-label="Deployment steps" className="-ml-2.5 flex items-start">
      {PIPELINE_STEPS.map(({ group, label, icon: Icon, tone }, index) => {
        const step = steps.get(group);
        const status: StepStatus = step?.status ?? "pending";
        const duration =
          step?.duration && step.duration !== DURATION_PLACEHOLDER ? step.duration : null;
        const description = `${label}: ${STATUS_LABEL[status]}${duration ? `, ${duration}` : ""}`;
        const isLast = index === PIPELINE_STEPS.length - 1;
        return (
          <li
            key={group}
            className={cn("flex items-start", !isLast && "flex-1")}
            aria-label={description}
            title={description}
          >
            <div className="flex w-11 shrink-0 flex-col items-center text-center">
              <span
                className={cn(
                  "relative flex h-6 w-6 items-center justify-center rounded-[4px]",
                  tone,
                  status === "pending" && "opacity-40",
                  status === "error" && "ring-1 ring-error/60",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <StatusBadge status={status} />
              </span>
              <span
                className={cn(
                  "mt-1 text-[11px] font-medium leading-4",
                  status === "pending" ? "text-muted-foreground" : "text-high-emphasis",
                )}
              >
                {label}
              </span>
              <span className="max-w-full truncate text-[10px] leading-3 tabular-nums text-muted-foreground">
                {duration ?? (status === "running" ? "Running" : "\u00a0")}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "mt-3 h-px flex-1",
                  status === "success" ? "bg-success/50" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default DeploymentSteps;
