/* eslint-disable @typescript-eslint/no-explicit-any */
import { http } from "@/lib/http-client";
import { ApiResponse } from "@/models/api-response.model";
import {
  IClientConfigResponse,
  IDeleteOidcClientPayload,
  IDeleteOidcClientResponse,
  IGetClientsPayload,
  ISaveClientCredentialPayload,
  ISaveClientCredentialResponse,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import { AUTH_CLIENT_ENDPOINTS } from "../constants/endpoint.constant";

export class AuthClientsService {
  getClientCredentials(
    payload: IGetClientsPayload,
  ): Promise<IClientConfigResponse[]> {
    return http.get(
      `${AUTH_CLIENT_ENDPOINTS.GET_CLIENT_CREDENTIALS}?ProjectKey=${payload.projectKey}`,
    );
  }

  saveClientCredential(
    payload: ISaveClientCredentialPayload,
  ): Promise<ApiResponse<ISaveClientCredentialResponse>> {
    return http.post(AUTH_CLIENT_ENDPOINTS.SAVE_CLIENT_CREDENTIAL, payload);
  }

  deleteClientCredential(
    payload: IDeleteOidcClientPayload,
  ): Promise<ApiResponse<IDeleteOidcClientResponse>> {
    return http.post(AUTH_CLIENT_ENDPOINTS.DELETE_CLIENT_CREDENTIAL, payload);
  }
}

export const authClientService = {
  clients: new AuthClientsService(),
};
