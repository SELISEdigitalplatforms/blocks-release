export enum ALERT_PROVIDERS {
  health = "health",
  resources = "resources",
}

export enum HttpMethods {
  GET = "1",
  POST = "2",
  HEAD = "0",
}
export const HTTP_METHODS: {
  label: string;
  value: HttpMethods;
}[] = [
  { label: "Head", value: HttpMethods.HEAD },
  { label: "Get", value: HttpMethods.GET },
  { label: "Post", value: HttpMethods.POST },
];
export enum ScheduleOptions {
  SIMPLE = "1",
  CRON = "2",
  CALENDER = "0",
}
export const SCHEDULES: {
  label: string;
  value: ScheduleOptions;
}[] = [
  { label: "Simple", value: ScheduleOptions.SIMPLE },
  { label: "Cron", value: ScheduleOptions.CRON },
  { label: "On Calender", value: ScheduleOptions.CALENDER },
];
export enum REPO_TYPE {
  repo_name = 0,
}

interface MonitorInterval {
  readonly [key: number]: number;
}

export const MONITOR_INTERVAL: MonitorInterval = {
  1: 30,
  2: 60,
  3: 300, // 5 minutes = 300 seconds
  4: 1800, // 12 hours = 43200 seconds
  5: 3600, // 24 hours = 86400 seconds
};
export const REVERSE_MONITOR_INTERVAL: { [key: number]: number } = {
  30: 1,
  60: 2,
  300: 3,
  1800: 4,
  3600: 5,
};

interface RequestTimeout {
  readonly [key: number]: number;
}

export const REQUEST_TIMEOUT: RequestTimeout = {
  1: 1,
  2: 15,
  3: 30,
  4: 45,
  5: 60,
};
export const REVERSE_REQUEST_TIMEOUT: { [key: number]: number } = {
  1: 1,
  15: 2,
  30: 3,
  45: 4,
  60: 5,
};

export enum REPO_DETAILS_PROVIDERS {
  DETAILS = "details",
  HISTORY = "history",
}

export enum MONITOR_SOURCE_TYPES {
  Infrastructure = "0",
  DeployedServices = "1",
  BlocksServices = "2",
  ExternalServices = "3",
}
