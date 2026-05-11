import { http } from "@/lib/http-client";
import { User } from "@blocks-idp/iam/models/user";
import { USER_ENDPOINTS } from "../constants/endpoint.constant";

export class UserService {
  constructor() {}

  getUser(): Promise<{ data: User }> {
    return http.get(USER_ENDPOINTS.GET_USER);
  }
}

export const userService = new UserService();
