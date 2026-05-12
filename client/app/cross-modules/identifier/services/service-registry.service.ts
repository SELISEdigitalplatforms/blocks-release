import { serviceInstances } from "@/lib/http-client";
import { SERVICE_REGISTRY_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";
import {
  IGetAllServicesPayload,
  IGetAllServicesResponse,
} from "../models/service.model";

export class ServiceRegistryService {
  private readonly httpClient = serviceInstances.logicService;
  getAllServices(
    payload: IGetAllServicesPayload,
  ): Promise<IGetAllServicesResponse> {
    return this.httpClient.post(SERVICE_REGISTRY_ENDPOINTS.GET_ALL, payload);
  }
}

export const serviceRegistryService = new ServiceRegistryService();
