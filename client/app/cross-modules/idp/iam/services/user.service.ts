import { serviceInstances } from "@/lib/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { User } from "@blocks-idp/iam/models/user";

export class UserService {
  private readonly httpClient = serviceInstances.idpService;
  getUser(): Promise<{ data: User }> {
    return this.httpClient.get(
      `${getRuntimeEnv("BLOCKS_IDP_BASE_URL")}/api/iam/me`,
      undefined,
      { absoluteUrl: true },
    );
  }
}

export const userService = new UserService();
