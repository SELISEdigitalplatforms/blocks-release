import { serviceInstances } from "@/lib/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";
import {
  ISigninByEmailPayload,
  ISigninByEmailResponse,
} from "@blocks-idp/authentication/models/auth.model";
import { AUTH_ENDPOINTS } from "../constants/endpoint.constant";

export class AuthService {
  private readonly httpClient = serviceInstances.deploymentService;
  private readonly idpHttpClient = serviceInstances.idpService;
  signinByEmail(
    payload: ISigninByEmailPayload,
  ): Promise<ISigninByEmailResponse> {
    const body = new URLSearchParams();
    body.append("grant_type", "password");
    body.append("username", payload.username);
    body.append("password", payload.password);

    // Login is issued by the IDP, not the deployment API.
    return this.idpHttpClient.post(
      AUTH_ENDPOINTS.TOKEN,
      body,
      {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      {
        skipTokenRotation: true,
      },
    );
  }

  verifyOidc(payload: {
    code: string;
    state: string;
  }): Promise<{ access_token: string; refresh_token: string }> {
    const body = new URLSearchParams();
    body.append("grant_type", "authorization_code");
    body.append("code", payload.code);
    body.append("state", payload.state);
    body.append("client_secret", "e048ec1b63d548dd85d053f364d5d54c");

    return this.httpClient.post(
      `${getRuntimeEnv("BLOCKS_IDP_BASE_URL")}${AUTH_ENDPOINTS.TOKEN}`,
      body,
      {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic c2VsaXNlYmxvY2tzOkJsMDNrc0B1JFU3VjEwUw==",
      },
      {
        absoluteUrl: true,
      },
    );
  }

  logout() {
    return this.idpHttpClient.post(AUTH_ENDPOINTS.LOGOUT, {});
  }
}

export const authService = new AuthService();
