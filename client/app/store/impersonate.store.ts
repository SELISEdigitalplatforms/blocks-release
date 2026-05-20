import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ImpersonateState {
  isImpersonated: boolean;
  impersonatedTenantId: string | null;
  originalTenantId: string | null;
  setImpersonation: (
    isImpersonated: boolean,
    originalTenantId: string | null,
    impersonatedTenantId: string | null,
  ) => void;
  startImpersonation: (
    impersonatedTenantId: string,
    originalTenantId: string,
  ) => void;
  stopImpersonation: () => void;

  reset: () => void;
}

export const useImpersonateStore = create<ImpersonateState>()(
  persist(
    (set) => ({
      isImpersonated: false,
      impersonatedTenantId: null,
      originalTenantId: null,
      setImpersonation: (
        isImpersonated: boolean,
        originalTenantId: string | null,
        impersonatedTenantId: string | null,
      ) => {
        set({ isImpersonated, impersonatedTenantId, originalTenantId });
      },
      startImpersonation: (
        impersonatedTenantId: string,
        originalTenantId: string,
      ) => {
        set({ isImpersonated: true, impersonatedTenantId, originalTenantId });
      },
      stopImpersonation: () => {
        set({
          isImpersonated: false,
          impersonatedTenantId: null,
          originalTenantId: null,
        });
      },
      reset: () => {
        set({
          isImpersonated: false,
          impersonatedTenantId: null,
          originalTenantId: null,
        });
      },
    }),
    {
      name: "impersonate-storage",
    },
  ),
);
