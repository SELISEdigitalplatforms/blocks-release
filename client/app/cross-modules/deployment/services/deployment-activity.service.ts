import { githubInfoService } from "./github-info.service";
import type { ContributionDay } from "@/components/ui/contribution-skyline";

export interface ActivityDeployment {
  itemId: string;
  createdDate: string;
  branch: string;
  status: string;
}

export interface DeploymentActivity {
  days: ContributionDay[];
  builds: ActivityDeployment[];
  /** The endpoint stopped advancing before the full history could be read. */
  isPartial?: boolean;
}

const PAGE_SIZE = 100;
const DAY_MS = 86_400_000;

/** Release timestamps without an offset are UTC, consistent with its DateTime records. */
export function deploymentTimestamp(value: string): number {
  if (typeof value !== "string" || !value.trim()) return NaN;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : value.includes("T")
      ? `${value}Z`
      : `${value}T00:00:00Z`;
  return Date.parse(normalized);
}

export function activityStart(endDate: string): number {
  const first = new Date(Date.parse(`${endDate}T00:00:00Z`) - 364 * DAY_MS);
  first.setUTCDate(first.getUTCDate() - first.getUTCDay());
  return first.getTime();
}

/** Read independently of the list's page size so navigating history never changes the calendar. */
export async function getDeploymentActivity(
  repoId: string,
  branch: string,
  endDate: string,
  signal?: AbortSignal,
): Promise<DeploymentActivity> {
  const start = activityStart(endDate);
  const end = Date.parse(`${endDate}T00:00:00Z`) + DAY_MS;
  const seen = new Set<string>();
  const builds: ActivityDeployment[] = [];
  let readCount = 0;
  let isPartial = false;

  for (let pageNumber = 1; ; pageNumber++) {
    signal?.throwIfAborted();
    const response = await githubInfoService.getRepoDetails(repoId, {
      branch,
      pageNumber,
      pageSize: PAGE_SIZE,
    });
    signal?.throwIfAborted();
    if (
      !response?.isSuccess ||
      !response.data ||
      (response.data.build != null && !Array.isArray(response.data.build))
    ) {
      throw new Error("Deployment activity could not be loaded.");
    }
    const page = (response.data.build ?? []) as ActivityDeployment[];
    const total = response.data.totalCount;
    if (!page.length) {
      isPartial = typeof total === "number" && readCount < total;
      break;
    }
    let added = 0;
    for (const build of page) {
      if (!build?.itemId || seen.has(build.itemId)) continue;
      seen.add(build.itemId);
      added++;
      const timestamp = deploymentTimestamp(build.createdDate);
      if (
        build.branch === branch &&
        Number.isFinite(timestamp) &&
        timestamp >= start &&
        timestamp < end
      ) {
        builds.push({
          itemId: build.itemId,
          createdDate: new Date(timestamp).toISOString(),
          branch: build.branch,
          status: build.status,
        });
      }
    }
    // Older Release instances can ignore paging and return the same successful page.
    // Keep the valid records already read rather than failing the entire calendar.
    if (!added) {
      isPartial = true;
      break;
    }
    readCount += page.length;
    // Release sorts newest first. Once a whole page predates the calendar, later
    // pages cannot contribute, so avoid reading years of irrelevant history.
    if (page.every((build) => deploymentTimestamp(build?.createdDate) < start)) break;
    if (typeof total === "number" && Number.isFinite(total)) {
      if (readCount >= total) break;
    } else if (page.length < PAGE_SIZE) break;
  }

  const counts = new Map<string, number>();
  for (const build of builds) {
    const day = build.createdDate.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return {
    days: [...counts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    builds: builds.sort((a, b) => b.createdDate.localeCompare(a.createdDate)),
    ...(isPartial ? { isPartial: true } : {}),
  };
}
