import { http } from "@/lib/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";
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
  private readonly alertBaseUrl = getRuntimeEnv("BLOCKS_LOGIC_APP_URL") + "/api";

  async addSingleMonitor(payload: IAddSingleMonitorPayload) {
    const url = `${this.alertBaseUrl}/Monitor/SaveMonitor`;
    return http.post<IAlertResponse<IAddSingleMonitorResponse>>(url, payload, undefined, {
      absoluteUrl: true,
    });
  }
  async updateSingleMonitor(payload: IUpdateMonitor) {
    const url = `${this.alertBaseUrl}/Monitor/UpdateMonitor`;
    return http.post<IAlertResponse<IAddSingleMonitorResponse>>(url, payload, undefined, {
      absoluteUrl: true,
    });
  }
  async deleteSingleMonitor(itemId: string) {
    const url = `${this.alertBaseUrl}/Monitor/DeleteMonitor?itemId=${encodeURIComponent(itemId)}`;
    return http.delete<IAlertResponse<null>>(url, undefined, { absoluteUrl: true });
  }

  async getMonitorList(projectKey: string) {
    const url = `${this.alertBaseUrl}/Monitor/GetMonitorList?ProjectKey=${encodeURIComponent(projectKey)}`;
    return http.get<IGetMonitorList>(url, undefined, { absoluteUrl: true });
  }
  async getMonitorListById(projectKey: string, repoId: string) {
    const url = `${this.alertBaseUrl}/Monitor/GetMonitorListByRepoId?ProjectKey=${encodeURIComponent(projectKey)}&repoId=${repoId}`;
    return http.get<IGetMonitorList>(url, undefined, { absoluteUrl: true });
  }
  async getMonitorDetails(monitorId: string) {
    const url = `${this.alertBaseUrl}/Monitor/GetMonitorDetails?monitorId=${encodeURIComponent(monitorId)}`;
    return http.get<IIncidentSummaryResponse>(url, undefined, { absoluteUrl: true });
  }
  async isExternalServiceConfigured(externalServiceId: string) {
    const url = `${this.alertBaseUrl}/Monitor/IsExternalServiceConfigured?externalServiceId=${encodeURIComponent(externalServiceId)}`;
    return http.get<IAlertResponse<IAddSingleMonitorResponse>>(url, undefined, {
      absoluteUrl: true,
    });
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

    const url = `${this.alertBaseUrl}/Monitor/GetMonitorList?${params.toString()}`;
    return http.get<any>(url, undefined, { absoluteUrl: true });
  }

  async getAllMonitorIncidentList(
    monitorId: string,
    pageNumber: number = 0,
    pageSize: number = 10,
  ) {
    const url = `${this.alertBaseUrl}/Monitor/GetIncidentList?monitorId=${encodeURIComponent(monitorId)}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
    return http.get<IMonitorIncidentListResponse>(url, undefined, { absoluteUrl: true });
  }
  async getMonitorById(monitorId: string) {
    const url = `${this.alertBaseUrl}/Monitor/GetMonitorById?monitorId=${encodeURIComponent(monitorId)}`;
    return http.get<GetMonitorByIdResponse>(url, undefined, { absoluteUrl: true });
  }

  async GetMonitorResponseTime(payload: { monitorId: string; startTime: string; endTime: string }) {
    const url = `${this.alertBaseUrl}/Monitor/GetMonitorResponseTime?monitorId=${encodeURIComponent(payload.monitorId)}&startTime=${encodeURIComponent(payload.startTime)}&endTime=${encodeURIComponent(payload.endTime)}`;
    return http.get<GetMonitorPingLogsResponse>(url, undefined, { absoluteUrl: true });
  }
  async GetMonitorDownTime(payload: { monitorId: string; startTime: string; endTime: string }) {
    const url = `${this.alertBaseUrl}/Monitor/GetMonitorDownTime?monitorId=${encodeURIComponent(payload.monitorId)}&startDate=${payload.startTime}&endDate=${payload.endTime}`;
    return http.get<GetMonitorPingLogsResponse>(url, undefined, { absoluteUrl: true });
  }
  async saveHealth(payload: ISaveHealth) {
    const url = `${this.alertBaseUrl}/Health/SaveHealth`;
    return http.post<ISaveSingleHealthResponse>(url, payload, undefined, { absoluteUrl: true });
  }
  async updateHealth(payload: IUpdateHealth) {
    const url = `${this.alertBaseUrl}/Health/UpdateHealth`;
    return http.post<any>(url, payload, undefined, { absoluteUrl: true });
  }
  async deleteHealth(itemId: string) {
    const url = `${this.alertBaseUrl}/Health/DeleteHealth?itemId=${encodeURIComponent(itemId)}`;
    return http.delete<any>(url, undefined, { absoluteUrl: true });
  }
}
export const alertsService = new AlertsService();
