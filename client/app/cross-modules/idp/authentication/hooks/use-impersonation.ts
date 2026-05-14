import { useMutation } from "@tanstack/react-query";
import { impersonationService } from "@blocks-idp/authentication/services/impersonation.service";
import type { ImpersonationRequest } from "../models/impersonate.model";

export const useStartImpersonation = () => {
  return useMutation({
    mutationKey: ["impersonation", "start"],
    mutationFn: (request: ImpersonationRequest) =>
      impersonationService.startImpersonation(request),
  });
};

export const useStopImpersonation = () => {
  return useMutation({
    mutationKey: ["impersonation", "stop"],
    mutationFn: () => impersonationService.stopImpersonation(),
  });
};
