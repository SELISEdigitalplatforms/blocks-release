import { authService } from "@blocks-idp/authentication/services/auth.service";
import { useMutation } from "@tanstack/react-query";

export const useLogout = () => {
  return useMutation({
    mutationKey: ["logout"],
    mutationFn: authService.logout,
  });
};
