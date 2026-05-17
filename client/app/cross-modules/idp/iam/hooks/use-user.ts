import { useAuthStore } from "@/store/auth.store";
import { userService } from "@blocks-idp/iam/services/user.service";
import { useQuery } from "@tanstack/react-query";

export const useGetUser = (options?: { enabled?: boolean }) => {
  const authStore = useAuthStore();
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const user = await userService.getUser();
      authStore.setUser(user.data);
      return user;
    },
    ...options,
  });
};
