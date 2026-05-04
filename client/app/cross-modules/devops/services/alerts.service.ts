import { http } from "@/lib/http-client";
import { ALERT_ENDPOINTS } from "@blocks-devops/constants/endpoint.constant";
import {
  GetMonitorByIdResponse,
  GetMonitorPingLogsResponse,
  IAddSingleMonitorPayload,
  IAddSingleMonitorResponse,
  IAlertResponse,
  IGetMonitorList,
  IIncidentSummaryResponse,
  IMonitorIncidentListResponse,
  ISaveHealth,
  ISaveSingleHealthResponse,
  IUpdateHealth,
  IUpdateMonitor,
} from "@blocks-devops/models/alerts";

class AlertsService {
  private readonly alertRequestOptions = { absoluteUrl: true };

  async addSingleMonitor(payload: IAddSingleMonitorPayload) {
    const url = ALERT_ENDPOINTS.SAVE_MONITOR;
    return http.post<IAlertResponse<IAddSingleMonitorResponse>>(
      url,
      payload,
      undefined,
      this.alertRequestOptions,
    );
  }
  async updateSingleMonitor(payload: IUpdateMonitor) {
    const url = ALERT_ENDPOINTS.UPDATE_MONITOR;
    return http.post<IAlertResponse<IAddSingleMonitorResponse>>(
      url,
      payload,
      undefined,
      this.alertRequestOptions,
    );
  }
  async deleteSingleMonitor(itemId: string) {
    const url = `${ALERT_ENDPOINTS.DELETE_MONITOR}?itemId=${encodeURIComponent(itemId)}`;
    return http.delete<IAlertResponse<null>>(url, undefined, this.alertRequestOptions);
  }

  async getMonitorList(projectKey: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_LIST}?ProjectKey=${encodeURIComponent(projectKey)}`;
    return http.get<IGetMonitorList>(url, undefined, this.alertRequestOptions);
  }
  async getMonitorListById(projectKey: string, repoId: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_LIST_BY_REPO_ID}?ProjectKey=${encodeURIComponent(projectKey)}&repoId=${repoId}`;
    return http.get<IGetMonitorList>(url, undefined, this.alertRequestOptions);
  }
  async getMonitorDetails(monitorId: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_DETAILS}?monitorId=${encodeURIComponent(monitorId)}`;
    return http.get<IIncidentSummaryResponse>(url, undefined, this.alertRequestOptions);
  }
  async isExternalServiceConfigured(externalServiceId: string) {
    const url = `${ALERT_ENDPOINTS.IS_EXTERNAL_SERVICE_CONFIGURED}?externalServiceId=${encodeURIComponent(externalServiceId)}`;
    return http.get<IAlertResponse<IAddSingleMonitorResponse>>(
      url,
      undefined,
      this.alertRequestOptions,
    );
  }

  async getHealthMonitorList(
    projectKey: string,
    monitorSourceType?: number,
    pageNumber: number = 0,
    pageSize: number = 10,
  ) {
    const params = new URLSearchParams({
      projectKey,
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
      ...(monitorSourceType !== undefined && {
        monitorSourceType: monitorSourceType.toString(),
      }),
    });

    const url = `${ALERT_ENDPOINTS.GET_MONITOR_LIST}?${params.toString()}`;
    return http.get<any>(url, undefined, this.alertRequestOptions);
  }

  async getAllMonitorIncidentList(
    monitorId: string,
    pageNumber: number = 0,
    pageSize: number = 10,
  ) {
    const url = `${ALERT_ENDPOINTS.GET_INCIDENT_LIST}?monitorId=${encodeURIComponent(monitorId)}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
    return http.get<IMonitorIncidentListResponse>(url, undefined, this.alertRequestOptions);
  }
  async getMonitorById(monitorId: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_BY_ID}?monitorId=${encodeURIComponent(monitorId)}`;
    return http.get<GetMonitorByIdResponse>(url, undefined, this.alertRequestOptions);
  }

  async GetMonitorResponseTime(payload: { monitorId: string; startTime: string; endTime: string }) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_RESPONSE_TIME}?monitorId=${encodeURIComponent(payload.monitorId)}&startTime=${encodeURIComponent(payload.startTime)}&endTime=${encodeURIComponent(payload.endTime)}`;
    return http.get<GetMonitorPingLogsResponse>(url, undefined, this.alertRequestOptions);
  }
  async GetMonitorDownTime(payload: { monitorId: string; startTime: string; endTime: string }) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_DOWN_TIME}?monitorId=${encodeURIComponent(payload.monitorId)}&startDate=${payload.startTime}&endDate=${payload.endTime}`;
    return http.get<GetMonitorPingLogsResponse>(url, undefined, this.alertRequestOptions);
  }
  async saveHealth(payload: ISaveHealth) {
    const url = ALERT_ENDPOINTS.SAVE_HEALTH;
    return http.post<ISaveSingleHealthResponse>(
      url,
      payload,
      undefined,
      this.alertRequestOptions,
    );
  }
  async updateHealth(payload: IUpdateHealth) {
    const url = ALERT_ENDPOINTS.UPDATE_HEALTH;
    return http.post<any>(url, payload, undefined, this.alertRequestOptions);
  }
  async deleteHealth(itemId: string) {
    const url = `${ALERT_ENDPOINTS.DELETE_HEALTH}?itemId=${encodeURIComponent(itemId)}`;
    return http.delete<any>(url, undefined, this.alertRequestOptions);
  }
}
export const alertsService = new AlertsService();
