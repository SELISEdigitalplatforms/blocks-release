import {
  MONITOR_INTERVAL,
  MONITOR_SOURCE_TYPES,
  REVERSE_MONITOR_INTERVAL,
} from "@/cross-modules/deployment/constants/alert.constant";
import type {
  IAddSingleMonitorPayload,
  IMonitorDetails,
  ISaveHealth,
  IUpdateHealth,
  IUpdateSingleMonitorPayload,
} from "@/cross-modules/deployment/models/alerts.model";
import type {
  MonitorConfigurationType,
  MonitorFormValues,
  SourceType,
} from "./schema";
import { getMonitorFormDefaultValues } from "./schema";

type SubmitContext = {
  itemId?: string;
  projectKey: string;
  repoName: string;
  externalServiceName: string;
};

const DEFAULT_REQUEST_BODY = '{"key":"value"}';

export const toMonitorSourceType = (
  sourceType: SourceType,
): MONITOR_SOURCE_TYPES => {
  if (sourceType === "deployed") return MONITOR_SOURCE_TYPES.DeployedServices;
  if (sourceType === "my-services")
    return MONITOR_SOURCE_TYPES.ExternalServices;
  return MONITOR_SOURCE_TYPES.OtherServices;
};

export const toSourceType = (
  monitorSourceTypes?: number | null,
): SourceType => {
  if (monitorSourceTypes === Number(MONITOR_SOURCE_TYPES.DeployedServices)) {
    return "deployed";
  }
  if (monitorSourceTypes === Number(MONITOR_SOURCE_TYPES.ExternalServices)) {
    return "my-services";
  }
  return "none";
};

export const toSliderStep = (
  seconds?: number | null,
  fallback: number = 2,
): number => {
  if (!seconds) return fallback;
  return REVERSE_MONITOR_INTERVAL[seconds] || fallback;
};

export const toSeconds = (step: number): number => {
  return MONITOR_INTERVAL[step] || MONITOR_INTERVAL[2];
};

const parseJsonSafe = (raw: string | null | undefined): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const getHeaderInfo = (customHttpHeaders: string | null | undefined) => {
  const parsed = parseJsonSafe(customHttpHeaders);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      headerName: "",
      headerValue: "",
      jsonSwitcher: false,
    };
  }

  const firstEntry = Object.entries(parsed)[0];
  if (!firstEntry) {
    return {
      headerName: "",
      headerValue: "",
      jsonSwitcher: false,
    };
  }

  const headerName = String(firstEntry[0] || "");
  const headerValue = String(firstEntry[1] || "");

  return {
    headerName,
    headerValue,
    jsonSwitcher: Boolean(headerName && headerValue),
  };
};

const getRequestBody = (customPayload: string | null | undefined): string => {
  const parsed = parseJsonSafe(customPayload);
  if (!parsed) return DEFAULT_REQUEST_BODY;

  try {
    return JSON.stringify(parsed);
  } catch {
    return DEFAULT_REQUEST_BODY;
  }
};

const getMonitorType = (
  monitorConfigurationType?: number,
): MonitorConfigurationType => {
  return monitorConfigurationType === 0 ? "request" : "callback";
};

export const toFormValuesFromMonitorDetails = (
  monitorDetails?: IMonitorDetails,
): MonitorFormValues => {
  if (!monitorDetails) {
    return getMonitorFormDefaultValues();
  }

  const { headerName, headerValue, jsonSwitcher } = getHeaderInfo(
    monitorDetails.customHttpHeaders,
  );

  return {
    name: monitorDetails.name || "",
    monitorConfigurationType: getMonitorType(
      monitorDetails.monitorConfigurationType,
    ),
    sourceType: toSourceType(monitorDetails.monitorSourceTypes),
    selectedRepoId: monitorDetails.repoId || "",
    selectedServiceId: monitorDetails.externalServiceId || "",
    urlMonitor: monitorDetails.url || "",
    monitorSettings: {
      monitor_interval: toSliderStep(monitorDetails.intervalInSeconds, 2),
      request_timeout: toSliderStep(monitorDetails.timeoutInSeconds, 3),
      grace_time: toSliderStep(monitorDetails.gracePeriodInSeconds, 3),
      check_ssl_errors: monitorDetails.checkSSLErrors || false,
      ssl_expiry_reminders: monitorDetails.sslExpiryReminders || false,
      domain_expiry_reminders: monitorDetails.domainExpiryReminders || false,
    },
    requestConfiguration: {
      http_methods: String(monitorDetails.httpMethodType ?? "0"),
      request_body: getRequestBody(monitorDetails.customPayload),
      json_switcher: jsonSwitcher,
      x_header_name: headerName,
      value: headerValue,
    },
  };
};

export const toCreateRequestPayload = (
  values: MonitorFormValues,
  context: SubmitContext,
): IAddSingleMonitorPayload => ({
  projectKey: context.projectKey,
  name: values.name,
  repoName: context.repoName,
  repoId: values.selectedRepoId,
  url: values.urlMonitor,
  monitorConfigurationType: 0,
  customPayload:
    values.requestConfiguration.http_methods === "2"
      ? values.requestConfiguration.request_body
      : "",
  intervalInSeconds: toSeconds(values.monitorSettings.monitor_interval),
  timeoutInSeconds: toSeconds(values.monitorSettings.request_timeout),
  customHttpHeaders: JSON.stringify({
    [values.requestConfiguration.x_header_name]:
      values.requestConfiguration.value,
  }),
  isActive: true,
  httpMethodType: values.requestConfiguration.http_methods,
  protocolType: "HTTP",
  externalServiceId: values.selectedServiceId,
  externalServiceName: context.externalServiceName,
  monitorSourceType: toMonitorSourceType(values.sourceType),
});

export const toUpdateRequestPayload = (
  values: MonitorFormValues,
  context: SubmitContext,
): IUpdateSingleMonitorPayload => ({
  itemId: context.itemId || "",
  projectKey: context.projectKey,
  authorizationType: null,
  name: values.name,
  repoName: context.repoName,
  repoId: values.selectedRepoId,
  url: values.urlMonitor,
  monitorConfigurationType: 0,
  customPayload:
    values.requestConfiguration.http_methods === "2"
      ? values.requestConfiguration.request_body
      : "",
  intervalInSeconds: toSeconds(values.monitorSettings.monitor_interval),
  timeoutInSeconds: toSeconds(values.monitorSettings.request_timeout),
  customHttpHeaders: JSON.stringify({
    [values.requestConfiguration.x_header_name]:
      values.requestConfiguration.value,
  }),
  isActive: true,
  httpMethodType: values.requestConfiguration.http_methods,
  protocolType: "HTTP",
  externalServiceId: values.selectedServiceId,
  externalServiceName: context.externalServiceName,
  monitorSourceType: toMonitorSourceType(values.sourceType),
});

export const toCreateCallbackPayload = (
  values: MonitorFormValues,
  context: SubmitContext,
): ISaveHealth => ({
  projectKey: context.projectKey,
  name: values.name,
  monitorConfigurationType: 1,
  intervalInSeconds: toSeconds(values.monitorSettings.monitor_interval),
  gracePeriodInSeconds: toSeconds(values.monitorSettings.grace_time),
  isActive: true,
  repoName: context.repoName,
  repoId: values.selectedRepoId,
  externalServiceId: values.selectedServiceId,
  externalServiceName: context.externalServiceName,
  monitorSourceType: toMonitorSourceType(values.sourceType),
});

export const toUpdateCallbackPayload = (
  values: MonitorFormValues,
  context: SubmitContext,
): IUpdateHealth => ({
  itemId: context.itemId || "",
  projectKey: context.projectKey,
  name: values.name,
  monitorConfigurationType: 1,
  intervalInSeconds: toSeconds(values.monitorSettings.monitor_interval),
  gracePeriodInSeconds: toSeconds(values.monitorSettings.grace_time),
  isActive: true,
  repoName: context.repoName,
  repoId: values.selectedRepoId,
  externalServiceId: values.selectedServiceId,
  externalServiceName: context.externalServiceName,
  monitorSourceType: toMonitorSourceType(values.sourceType),
});
