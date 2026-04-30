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
  async addSingleMonitor(payload: IAddSingleMonitorPayload) {
    const url = ALERT_ENDPOINTS.SAVE_MONITOR;
    return http.post<IAlertResponse<IAddSingleMonitorResponse>>(url, payload);
  }
  async updateSingleMonitor(payload: IUpdateMonitor) {
    const url = ALERT_ENDPOINTS.UPDATE_MONITOR;
    return http.post<IAlertResponse<IAddSingleMonitorResponse>>(url, payload);
  }
  async deleteSingleMonitor(itemId: string) {
    const url = `${ALERT_ENDPOINTS.DELETE_MONITOR}?itemId=${encodeURIComponent(itemId)}`;
    return http.delete<IAlertResponse<null>>(url);
  }

  async getMonitorList(projectKey: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_LIST}?ProjectKey=${encodeURIComponent(projectKey)}`;
    return http.get<IGetMonitorList>(url);
  }
  async getMonitorListById(projectKey: string, repoId: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_LIST_BY_REPO_ID}?ProjectKey=${encodeURIComponent(projectKey)}&repoId=${repoId}`;
    return http.get<IGetMonitorList>(url);
  }
  async getMonitorDetails(monitorId: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_DETAILS}?monitorId=${encodeURIComponent(monitorId)}`;
    return http.get<IIncidentSummaryResponse>(url);
  }
  async isExternalServiceConfigured(externalServiceId: string) {
    const url = `${ALERT_ENDPOINTS.IS_EXTERNAL_SERVICE_CONFIGURED}?externalServiceId=${encodeURIComponent(externalServiceId)}`;
    return http.get<IAlertResponse<IAddSingleMonitorResponse>>(url);
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
    return http.get<any>(url);
  }

  async getAllMonitorIncidentList(
    monitorId: string,
    pageNumber: number = 0,
    pageSize: number = 10,
  ) {
    const url = `${ALERT_ENDPOINTS.GET_INCIDENT_LIST}?monitorId=${encodeURIComponent(monitorId)}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
    return http.get<IMonitorIncidentListResponse>(url);
  }
  async getMonitorById(monitorId: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_BY_ID}?monitorId=${encodeURIComponent(monitorId)}`;
    return http.get<GetMonitorByIdResponse>(url);
  }

  async GetMonitorResponseTime(payload: { monitorId: string; startTime: string; endTime: string }) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_RESPONSE_TIME}?monitorId=${encodeURIComponent(payload.monitorId)}&startTime=${encodeURIComponent(payload.startTime)}&endTime=${encodeURIComponent(payload.endTime)}`;
    return http.get<GetMonitorPingLogsResponse>(url);
  }
  async GetMonitorDownTime(payload: { monitorId: string; startTime: string; endTime: string }) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_DOWN_TIME}?monitorId=${encodeURIComponent(payload.monitorId)}&startDate=${payload.startTime}&endDate=${payload.endTime}`;
    return http.get<GetMonitorPingLogsResponse>(url);
  }
  async saveHealth(payload: ISaveHealth) {
    const url = ALERT_ENDPOINTS.SAVE_HEALTH;
    return http.post<ISaveSingleHealthResponse>(url, payload);
  }
  async updateHealth(payload: IUpdateHealth) {
    const url = ALERT_ENDPOINTS.UPDATE_HEALTH;
    return http.post<any>(url, payload);
  }
  async deleteHealth(itemId: string) {
    const url = `${ALERT_ENDPOINTS.DELETE_HEALTH}?itemId=${encodeURIComponent(itemId)}`;
    return http.delete<any>(url);
  }
}
export const alertsService = new AlertsService();
