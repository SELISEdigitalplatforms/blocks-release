import { serviceInstances } from "@/lib/http-client";
import { User } from "@blocks-idp/iam/models/user";
import { USER_ENDPOINTS } from "../constants/endpoint.constant";

export class UserService {
  private readonly httpClient = serviceInstances.idpService;
  getUser(): Promise<{ data: User }> {
    return this.httpClient.get(USER_ENDPOINTS.GET_USER);
  }
}

export const userService = new UserService();
