import { serviceInstances } from "@/lib/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { useAuthStore } from "@/store/useAuthStore";
import {
  ISigninByEmailPayload,
  ISigninByEmailResponse,
} from "@blocks-idp/authentication/models/auth.model";
import { AUTH_ENDPOINTS } from "../constants/endpoint.constant";

export class AuthService {
  private readonly httpClient = serviceInstances.deploymentService;
  signinByEmail(
    payload: ISigninByEmailPayload,
  ): Promise<ISigninByEmailResponse> {
    const body = new URLSearchParams();
    body.append("grant_type", "password");
    body.append("username", payload.username);
    body.append("password", payload.password);

    return this.httpClient.post(
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
      `https://dev-idp.blocksdevelopers.com${AUTH_ENDPOINTS.TOKEN}`,
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
    // For localhost, send actual refresh token; for remote, send empty (uses cookie)
    const isLocalhost = getRuntimeEnv("BLOCKS_API_BASE_URL")?.includes(
      "localhost",
    );
    const refreshToken = isLocalhost
      ? useAuthStore.getState().refreshToken || ""
      : "";
    return this.httpClient.post(AUTH_ENDPOINTS.LOGOUT, { refreshToken });
  }
}

export const authService = new AuthService();
