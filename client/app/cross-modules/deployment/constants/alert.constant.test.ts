import { describe, expect, it } from "vitest";
import {
  ALERT_PROVIDERS,
  HTTP_METHODS,
  HttpMethods,
  MONITOR_INTERVAL,
  MONITOR_SOURCE_TYPES,
  REQUEST_TIMEOUT,
  REPO_DETAILS_PROVIDERS,
  REVERSE_MONITOR_INTERVAL,
  REVERSE_REQUEST_TIMEOUT,
  SCHEDULES,
  ScheduleOptions,
} from "./alert.constant";

describe("alert constants", () => {
  it("exposes provider and method enums", () => {
    expect(ALERT_PROVIDERS.health).toBe("health");
    expect(HttpMethods.GET).toBe("1");
    expect(ScheduleOptions.CRON).toBe("2");
    expect(REPO_DETAILS_PROVIDERS.DETAILS).toBe("details");
    expect(REPO_DETAILS_PROVIDERS.HISTORY).toBe("history");
    expect(REPO_DETAILS_PROVIDERS.SECRETS).toBe("secrets");
    expect(MONITOR_SOURCE_TYPES.BlocksServices).toBe("2");
  });

  it("exposes the option lists", () => {
    expect(HTTP_METHODS).toHaveLength(3);
    expect(SCHEDULES.map((s) => s.value)).toContain(ScheduleOptions.SIMPLE);
  });

  it("keeps interval maps consistent both ways", () => {
    expect(MONITOR_INTERVAL[1]).toBe(30);
    expect(REVERSE_MONITOR_INTERVAL[30]).toBe(1);
    expect(REQUEST_TIMEOUT[5]).toBe(60);
    expect(REVERSE_REQUEST_TIMEOUT[60]).toBe(5);
  });
});
