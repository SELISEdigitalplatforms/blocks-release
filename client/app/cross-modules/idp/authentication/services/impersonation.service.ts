import { serviceInstances } from "@/lib/http-client";
import type {
  ImpersonationRequest,
  ImpersonationState,
} from "../models/impersonate.model";
import { IMPERSONATION_ENDPOINTS } from "../constants/endpoint.constant";

class ImpersonationService {
  private readonly httpClient = serviceInstances.idpService;

  startImpersonation(
    request: ImpersonationRequest,
  ): Promise<ImpersonationState> {
    return this.httpClient.post(
      `${IMPERSONATION_ENDPOINTS.IMPERSONATE}`,
      request,
    );
  }

  stopImpersonation(): Promise<void> {
    return this.httpClient.post(
      `${IMPERSONATION_ENDPOINTS.STOP_IMPERSONATION}`,
      null,
    );
  }
}

export const impersonationService = new ImpersonationService();
