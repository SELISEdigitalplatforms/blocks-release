import type {
  ApiPaginatedResponse,
  ProjectKey,
} from "@/models";
import { MONITOR_SOURCE_TYPES } from "../constants/alert.constant";

export interface IAttributes {
  [key: string]: string | number | undefined;
}

export interface Alert {
  timestamp: string;
  alertId: string;
  spanId: string;
  parentSpanId: string;
  parentId: string;
  kind: string;
  activitySourceName: string;
  operationName: string;
  startTime: string;
  endTime: string;
  duration: number;
  attributes: IAttributes;
  status: string;
  statusDescription: string;
  baggage: {
    TenantId: string;
    IsFromCloud: string;
  };
  serviceName: string;
}

export interface IIncidentSummaries {
  startTime: string;
  endTime: string;
  downtimeDurationSeconds?: number;
}

export interface AlertTree extends Alert {
  authorizationType: number;
  createdBy: string;
  createdDate: string;
  currentStatus: boolean;
  customHttpHeaders: string | null;
  customPayload: string | null;
  emails: string[];
  expectedContent: string | null;
  httpMethodType: number;
  isActive: boolean;
  language: string | null;
  lastUpdatedBy: string;
  lastUpdatedDate: string;
  organizationIds: string[];
  protocolType: number;
  regions: string[];
  repoId: string;
  successHttpResponseCodes: number[];
  tenantId: string;
  timeoutInSeconds: number;
  itemId: string;
  incidentSummaries: IIncidentSummaries[];
  name: string;
  url: string;
  repoName: string;
  subEntries: AlertTree[] | [];
  lastIncidentAt: Date;
  monitorType: number;
  monitorConfigurationType: number;
  monitorSourceTypes: number;
  externalServiceId: string | null;
  externalServiceName: string | null;
}

interface BaseMonitorPayload {
  projectKey: ProjectKey;
  name: string;
  monitorConfigurationType: number;
  monitorSourceType: MONITOR_SOURCE_TYPES;
  intervalInSeconds: number;
  isActive: boolean;
}

export interface IUpdateSingleMonitorPayload extends BaseMonitorPayload {
  itemId: string;
  repoId: string;
  repoName: string;
  externalServiceId: string | null;
  externalServiceName: string | null;
  url: string;
  protocolType: string;
  httpMethodType: string;
  authorizationType: string | null;
  timeoutInSeconds: number;
  customHttpHeaders: string;
  customPayload: string;
}

export interface IUpdateHealth extends BaseMonitorPayload {
  itemId: string;
  repoName: string;
  repoId: string;
  externalServiceId: string | null;
  externalServiceName: string | null;
  gracePeriodInSeconds: number;
}

export interface IAlertResponse<T> {
  errors: string[] | null;
  isSuccess: boolean;
  message: string;
  statusCode: number;
  data: T;
}

export interface IGetMonitorList extends ApiPaginatedResponse<
  AlertTree,
  string[] | null
> {}

export interface IAddSingleMonitorResponse {
  tenantId: string;
  repoId: string;
  repoName: string;
  name: string;
  url: string;
  monitorType: number;
  protocolType: number;
  httpMethodType: number;
  authorizationType: number;
  intervalInSeconds: number;
  timeoutInSeconds: number;
  isActive: boolean;
  expectedContent: string | null;
  customHttpHeaders: string;
  customPayload: string;
  successHttpResponseCodes: number[];
  regions: string[];
  emails: string[];
  lastIncidentAt: string;
  currentStatus: boolean;
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  language: string | null;
  lastUpdatedBy: string;
  organizationIds: string[];
  tags: string[];
}

export interface ISaveHealthResponse extends IAddSingleMonitorResponse {
  monitorConfigurationType: number;
  monitorSourceTypes: number;
  gracePeriodInSeconds: number;
  lastCheckedAt: string;
  incidentSummaries: IIncidentSummaries[];
}

export interface ISaveSingleHealthResponse {
  data: ISaveHealthResponse;
  isSuccess: boolean;
  message: string;
  statusCode: number;
  errors: string[] | null;
}

export interface IDeleteHealthResponse {
  isSuccess: boolean;
  message: string;
  statusCode: number;
  errors: string[] | null;
}
