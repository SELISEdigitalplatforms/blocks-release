import { splitLogLine } from "@blocks-deployment/utils/deployment-logs.utils";

type LogLineTextProps = {
  line: string;
};

/**
 * One line of a step's log body, with the Kubernetes timestamp prefix dimmed so
 * the message reads first.
 *
 * The prefix keeps its place inline - this is not a separate column, and the
 * gutter and horizontal scroll container are untouched. A line with no parseable
 * prefix renders as a single unstyled run, so nothing is wrapped in an empty
 * element and no whitespace is invented.
 *
 * Shared by the live and deployed views rather than duplicated: the two used to
 * trim their lines differently, which meant the same line could render two ways
 * depending on which page you were on.
 */
export const LogLineText = ({ line }: LogLineTextProps) => {
  const { timestamp, separator, text } = splitLogLine(
    typeof line === "string" ? line.trim() : "",
  );

  if (timestamp === null) return <>{text}</>;

  return (
    <>
      <span className="text-low-emphasis">{timestamp}</span>
      {separator}
      {text}
    </>
  );
};
