import type {
  GetMonitorByIdResponse,
  GetMonitorPingLogsResponse,
  IAddSingleMonitorPayload,
  IAddSingleMonitorResponse,
  IAlertResponse,
  IDeleteHealthResponse,
  IGetHealthMonitorListPayload,
  IGetMonitorList,
  IIncidentSummaryResponse,
  IMonitorIncidentListResponse,
  ISaveHealth,
  ISaveSingleHealthResponse,
  IUpdateHealth,
  IUpdateSingleMonitorPayload,
} from "@/cross-modules/deployment/models/alerts.model";
import { http } from "@/lib/http-client";
import { ALERT_ENDPOINTS } from "@blocks-deployment/constants/endpoint.constant";

class AlertsService {
  async addSingleMonitor(payload: IAddSingleMonitorPayload) {
    console.log("addSingleMonitor", payload);
    const url = ALERT_ENDPOINTS.SAVE_MONITOR;
    return http.post<IAlertResponse<IAddSingleMonitorResponse>>(
      url,
      payload,
      undefined,
      { absoluteUrl: true },
    );
  }
  async updateSingleMonitor(payload: Partial<IUpdateSingleMonitorPayload>) {
    const url = ALERT_ENDPOINTS.UPDATE_MONITOR;
    return http.post<IAlertResponse<IAddSingleMonitorResponse>>(
      url,
      payload,
      undefined,
      { absoluteUrl: true },
    );
  }
  async deleteSingleMonitor(itemId: string) {
    const url = `${ALERT_ENDPOINTS.DELETE_MONITOR}?itemId=${encodeURIComponent(itemId)}`;
    return http.delete<IAlertResponse<null>>(url, undefined, {
      absoluteUrl: true,
    });
  }

  async getMonitorList(projectKey: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_LIST}?ProjectKey=${encodeURIComponent(projectKey)}`;
    return http.get<IGetMonitorList>(url, undefined, { absoluteUrl: true });
  }
  async getMonitorListById(projectKey: string, repoId: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_LIST_BY_REPO_ID}?ProjectKey=${encodeURIComponent(projectKey)}&repoId=${repoId}`;
    return http.get<IGetMonitorList>(url, undefined, { absoluteUrl: true });
  }
  async getMonitorDetails(monitorId: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_DETAILS}?monitorId=${encodeURIComponent(monitorId)}`;
    return http.get<IIncidentSummaryResponse>(url, undefined, {
      absoluteUrl: true,
    });
  }
  async isExternalServiceConfigured(externalServiceId: string) {
    const url = `${ALERT_ENDPOINTS.IS_EXTERNAL_SERVICE_CONFIGURED}?externalServiceId=${encodeURIComponent(externalServiceId)}`;
    return http.get<IAlertResponse<IAddSingleMonitorResponse>>(url, undefined, {
      absoluteUrl: true,
    });
  }

  async getHealthMonitorList({
    projectKey,
    pageNumber,
    pageSize,
    monitorSourceType,
  }: IGetHealthMonitorListPayload) {
    const params = new URLSearchParams({
      projectKey,
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
      ...(monitorSourceType !== null && {
        monitorSourceType: monitorSourceType.toString(),
      }),
    });

    const url = `${ALERT_ENDPOINTS.GET_MONITOR_LIST}?${params.toString()}`;
    return http.get<IGetMonitorList>(url, undefined, { absoluteUrl: true });
  }

  async getAllMonitorIncidentList(
    monitorId: string,
    pageNumber: number = 0,
    pageSize: number = 10,
  ) {
    const url = `${ALERT_ENDPOINTS.GET_INCIDENT_LIST}?monitorId=${encodeURIComponent(monitorId)}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
    return http.get<IMonitorIncidentListResponse>(url, undefined, {
      absoluteUrl: true,
    });
  }
  async getMonitorById(monitorId: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_BY_ID}?monitorId=${encodeURIComponent(monitorId)}`;
    return http.get<GetMonitorByIdResponse>(url, undefined, {
      absoluteUrl: true,
    });
  }

  async GetMonitorResponseTime(payload: {
    monitorId: string;
    startTime: string;
    endTime: string;
  }) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_RESPONSE_TIME}?monitorId=${encodeURIComponent(payload.monitorId)}&startTime=${encodeURIComponent(payload.startTime)}&endTime=${encodeURIComponent(payload.endTime)}`;
    return http.get<GetMonitorPingLogsResponse>(url, undefined, {
      absoluteUrl: true,
    });
  }
  async GetMonitorDownTime(payload: {
    monitorId: string;
    startTime: string;
    endTime: string;
  }) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_DOWN_TIME}?monitorId=${encodeURIComponent(payload.monitorId)}&startDate=${encodeURIComponent(payload.startTime)}&endDate=${encodeURIComponent(payload.endTime)}`;
    return http.get<GetMonitorPingLogsResponse>(url, undefined, {
      absoluteUrl: true,
    });
  }
  async saveHealth(payload: ISaveHealth) {
    const url = ALERT_ENDPOINTS.SAVE_HEALTH;
    return http.post<ISaveSingleHealthResponse>(url, payload, undefined, {
      absoluteUrl: true,
    });
  }
  async updateHealth(payload: Partial<IUpdateHealth>) {
    const url = ALERT_ENDPOINTS.UPDATE_HEALTH;
    return http.post<ISaveSingleHealthResponse>(url, payload, undefined, {
      absoluteUrl: true,
    });
  }
  async deleteHealth(itemId: string) {
    const url = `${ALERT_ENDPOINTS.DELETE_HEALTH}?itemId=${encodeURIComponent(itemId)}`;
    return http.delete<IDeleteHealthResponse>(url, undefined, {
      absoluteUrl: true,
    });
  }
}
export const alertsService = new AlertsService();
