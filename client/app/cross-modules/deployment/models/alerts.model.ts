import type {
  ApiPaginatedResponse,
  BaseRequestParams,
  ProjectKey,
} from "@/models";
import { MONITOR_SOURCE_TYPES } from "../constants/alert.constant";

export interface ITags {
  ecosystem: string;
  habitat: string;
  uriClient: string;
}
export interface IAttributes {
  [key: string]: string | number | undefined;
}
export interface ISecurityContext {
  TenantId: string;
  Roles: [];
  UserId: string;
  Audiances: string | null;
  RequestUri: string;
  OrganizationId: string;
  IsAuthenticated: boolean;
}
export interface IRequest {
  url: string;
  Headers: {
    host: string;
    Alertparent: string;
    xBlocksKey: string;
  };
}

export interface IResponse {
  statusCode: number;
  headers: {
    contentType: string;
    date: Date;
    server: string;
    transferEncoding: string;
  };
}
export interface IIssue {
  icon: string;
  description: string;
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
  createdDate: string; // ISO date string
  currentStatus: boolean;
  customHttpHeaders: string | null;
  customPayload: string | null;
  emails: string[];
  expectedContent: string | null;
  httpMethodType: number;
  isActive: boolean;
  language: string | null;
  lastUpdatedBy: string;
  lastUpdatedDate: string; // ISO date string
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
  tags: ITags;
  attributes: IAttributes;
  securityContext: ISecurityContext;
  request: IRequest;
  response: IResponse;
  subEntries: AlertTree[] | [];
  calculatedDuration?: number;
  calculatedStartTime?: string;
  calculatedEndTime?: string;
  intervalInSeconds?: number;
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

export interface IAddSingleMonitorPayload extends Partial<IUpdateSingleMonitorPayload> {}

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
export interface ISaveHealth extends Partial<IUpdateHealth> {}
export interface IUpdateHealth extends BaseMonitorPayload {
  itemId: string;
  repoName: string;
  repoId: string;
  externalServiceId: string | null;
  externalServiceName: string | null;
  gracePeriodInSeconds: number;
}

export interface IUpdateMonitor {
  itemId: string;
  isActive: boolean;
  projectKey?: string;
  repoId?: string;
  repoName?: string;
  name?: string;
  url?: string;
  monitorType?: string;
  protocolType?: string;
  httpMethodType?: string;
  authorizationType: string | null;
  intervalInSeconds?: number;
  timeoutInSeconds?: number;
  expectedContent?: string;
  customHttpHeaders?: string;
  customPayload?: string;
  successHttpResponseCodes?: string[];
  regions?: string[];
  emails?: string[];
}
export interface IAlertResponse<T> {
  errors: string[] | null;
  isSuccess: boolean;
  message: string;
  statusCode: number;
  data: T;
}
export interface IGetHealthMonitorListPayload extends BaseRequestParams {
  projectKey: ProjectKey;
  monitorSourceType: MONITOR_SOURCE_TYPES | null;
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
export interface MonitorDetails {
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
  customPayload: string | null;
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
export interface AlertList {
  data: MonitorDetails;
  message: string;
  statusCode: number;
  errors: string | null;
  isSuccess: boolean;
}

export interface IMonitorIncidentListResponse {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  data: IncidentTree[];
  message: string;
  statusCode: number;
  errors: string | null;
  isSuccess: boolean;
}
export interface PingLog {
  monitorId: string;
  timestamp: string;
  responseTimeMs: number;
  statusCode: number;
}
export type IResponseType = {
  startTime: string;
  endTime: string;
  downtimeDurationSeconds: number;
};

export interface GetMonitorPingLogsResponse {
  data: IResponseType[];
  message: string;
  statusCode: number;
  errors: string | null;
  isSuccess: boolean;
}

export interface IMonitor {
  authorizationType: number;
  createdBy: string;
  createdDate: string; // ISO date string
  currentStatus: boolean;
  customHttpHeaders: string | null;
  customPayload: string | null;
  emails: string[];
  expectedContent: string | null;
  httpMethodType: number;
  intervalInSeconds: number;
  isActive: boolean;
  itemId: string;
  language: string | null;
  lastIncidentAt: string; // ISO date string
  lastUpdatedBy: string;
  lastUpdatedDate: string; // ISO date string
  monitorType: number;
  name: string;
  organizationIds: string[];
  protocolType: number;
  regions: string[];
  repoId: string;
  repoName: string;
  successHttpResponseCodes: number[];
  tags: string[];
  tenantId: string;
  timeoutInSeconds: number;
  url: string;
}

export interface IMonitorListResponse {
  data: IMonitor[];
  message: string;
  statusCode: number;
  errors: string | null;
  isSuccess: boolean;
  isLoading: boolean;
}
export interface IMonitorDetails {
  authorizationType: number;
  createdBy: string;
  createdDate: string;
  currentStatus: false;
  customHttpHeaders: string;
  customPayload: string;
  emails: [];
  expectedContent: null;
  httpMethodType: number;
  intervalInSeconds: number;
  isActive: true;
  itemId: string;
  language: null;
  lastIncidentAt: string;
  lastUpdatedBy: string;
  lastUpdatedDate: string;
  monitorType: number;
  name: string;
  organizationIds: [];
  protocolType: number;
  regions: [];
  repoId: string | null;
  repoName: string | null;
  externalServiceId: string | null;
  externalServiceName: string | null;
  successHttpResponseCodes: [];
  tags: [];
  tenantId: string;
  timeoutInSeconds: number;
  url: string;
  monitorConfigurationType: number;
  gracePeriodInSeconds: number;
  monitorSourceTypes: number;
  checkSSLErrors?: boolean;
  sslExpiryReminders?: boolean;
  domainExpiryReminders?: boolean;
}
export interface GetMonitorByIdResponse {
  data: IMonitorDetails;
  message: string;
  statusCode: number;
  errors: string | null;
  isSuccess: boolean;
}
export interface IncidentTree {
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  projectKey: string;
  startTime: string;
  endTime: string;
  lastStatusCode: number;
  isResolved: boolean;
  failureReason: string | null;
  responseBody: string | null;
  downtimeDurationSeconds: number;
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string | null;
  language: string | null;
  lastUpdatedBy: string | null;
  organizationIds: string[];
  tags: string[];
  request?: { url?: string };
  url?: string;
}
export interface IIncidentSummaryResponse {
  dateRangeSummary: IMonitorSummary[];
  monitorIncidents: IncidentTree[];
  message: string;
  statusCode: number;
  errors: string | null;
  isSuccess: boolean;
  data: null;
  statusDuration?: string;
}

export interface IMonitorSummary {
  range?: string;
  totalDurationMs?: number;
  incidentCount?: number;
  type: "range" | "status";
  status?: "up" | "down";
  statusDuration?: string;
}
