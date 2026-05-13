import { serviceInstances } from "@/lib/http-client";
import { User } from "@blocks-idp/iam/models/user";

export class UserService {
  private readonly httpClient = serviceInstances.idpService;
  getUser(): Promise<{ data: User }> {
    return this.httpClient.get(
      "https://dev-idp.blocksdevelopers.com/api/Iam/user",
      undefined,
      { absoluteUrl: true },
    );
  }
}

export const userService = new UserService();
