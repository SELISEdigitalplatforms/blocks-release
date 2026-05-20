import { create } from "zustand";

interface ImpersonateState {
  isImpersonated: boolean;
  impersonatedTenantId: string | null;
  originalTenantId: string | null;

  isInitialized: boolean;

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

  setInitialized: (isInitialized: boolean) => void;

  reset: () => void;
}

export const useImpersonateStore = create<ImpersonateState>()((set) => ({
  isImpersonated: false,
  impersonatedTenantId: null,
  originalTenantId: null,
  isInitialized: false,
  startImpersonation: (
    impersonatedTenantId: string,
    originalTenantId: string,
  ) => {
    set({ isImpersonated: true, impersonatedTenantId, originalTenantId });
  },
  setImpersonation: (
    isImpersonated: boolean,
    originalTenantId: string | null,
    impersonatedTenantId: string | null,
  ) => {
    set({ isImpersonated, impersonatedTenantId, originalTenantId });
  },
  stopImpersonation: () => {
    set((state) => ({
      ...state,
      isImpersonated: false,
      impersonatedTenantId: null,
    }));
  },
  setInitialized: (isInitialized: boolean) => {
    set({ isInitialized });
  },
  reset: () => {
    set({
      isImpersonated: false,
      impersonatedTenantId: null,
      originalTenantId: null,
    });
  },
}));
