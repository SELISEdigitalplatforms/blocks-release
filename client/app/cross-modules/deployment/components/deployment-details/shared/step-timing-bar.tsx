import { IBuildStep } from "@blocks-deployment/models/live-logs";
import { DURATION_PLACEHOLDER } from "@blocks-deployment/utils/deployment-logs.utils";
import { formatClockTime } from "@/utils/date.util";

type StepTimingBarProps = {
  step: IBuildStep;
};

/**
 * When a step ran, shown above its log lines.
 *
 * Renders nothing at all when the step has no resolved range - an empty bar, or
 * one made of dashes, would suggest the information exists but is missing.
 *
 * Poller-derived times drop the millisecond digits: the backend samples on a
 * five-second loop, so three trailing zeros would claim a precision it does not
 * have. The format itself is the signal for which clock the value came from.
 */
export const StepTimingBar = ({ step }: StepTimingBarProps) => {
  const { startTime, endTime, duration, timingSource } = step;

  // `duration` is the placeholder whenever the range is not presentable - no
  // range at all, or a lone start marker with nothing to span to.
  if (
    !startTime ||
    !endTime ||
    !timingSource ||
    timingSource === "none" ||
    duration === DURATION_PLACEHOLDER
  ) {
    return null;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const withMillis = timingSource === "logs";
  const approximate = timingSource === "events" ? "~" : "";

  return (
    <div className="border-default flex flex-wrap items-center gap-x-2 border-b bg-secondary px-3 py-1.5 text-xs text-medium-emphasis">
      <span>
        Started {approximate}
        {formatClockTime(start, withMillis)}
      </span>
      <span aria-hidden="true">·</span>
      <span>
        Ended {approximate}
        {formatClockTime(end, withMillis)}
      </span>
      <span aria-hidden="true">·</span>
      <span>Took {duration}</span>
    </div>
  );
};
