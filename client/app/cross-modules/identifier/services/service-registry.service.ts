import { http } from "@/lib/http-client";
import { SERVICE_REGISTRY_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";
import {
  IGetAllServicesPayload,
  IGetAllServicesResponse,
} from "../models/service.model";

export class ServiceRegistryService {
  getAllServices(
    payload: IGetAllServicesPayload,
  ): Promise<IGetAllServicesResponse> {
    return http.post(SERVICE_REGISTRY_ENDPOINTS.GET_ALL, payload);
  }
}

export const serviceRegistryService = new ServiceRegistryService();
