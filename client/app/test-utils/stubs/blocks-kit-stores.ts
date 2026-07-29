/**
 * Shared zustand stores for the blocks-kit test doubles.
 *
 * The real `@seliseblocks/genesis-os` package owns project/auth/app-settings
 * state, but its barrel eagerly instantiates services (NotificationListener,
 * framer-motion) that crash under jsdom. These stores stand in for the real
 * ones so components that read selected-project / auth / theme state render in
 * unit tests. Both the barrel double and the `/store` subpath double re-export
 * these instances, so a component and its test observe the same state.
 */
import { create } from "zustand";

export interface StubProject {
  itemId: string;
  tenantId: string;
  tenantGroupId: string;
  name: string;
  applicationDomain: string;
  customDomain: string;
  isProduction: boolean;
  environment: string;
  tenantSlug: string;
  [key: string]: unknown;
}

const defaultProject: StubProject = {
  itemId: "test-project-id",
  tenantId: "test-tenant-id-123",
  tenantGroupId: "test-tenant-group-id",
  name: "Test Project",
  applicationDomain: "https://test.seliseblocks.com",
  customDomain: "",
  isProduction: false,
  environment: "dev",
  tenantSlug: "test-project",
};

interface ProjectState {
  selectedProject: StubProject | null;
  selectedTenantGroup: string;
  projects: StubProject[];
  setSelectedProject: (project: StubProject | null) => void;
  resetSelectedProject: () => void;
  setProjects: (projects: StubProject[]) => void;
  resetProject: () => void;
  reset: () => void;
  setTenantGroup: (id: string) => void;
  setTennantGroup: (id: string) => void;
  resetTennantGroup: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  selectedProject: defaultProject,
  selectedTenantGroup: "test-tenant-group-id",
  projects: [defaultProject],
  setSelectedProject: (project) => set({ selectedProject: project }),
  resetSelectedProject: () => set({ selectedProject: null }),
  setProjects: (projects) => set({ projects }),
  resetProject: () => set({ selectedProject: null, projects: [] }),
  reset: () => set({ selectedProject: null, projects: [], selectedTenantGroup: "" }),
  setTenantGroup: (id) => set({ selectedTenantGroup: id }),
  setTennantGroup: (id) => set({ selectedTenantGroup: id }),
  resetTennantGroup: () => set({ selectedTenantGroup: "" }),
}));

interface AuthState {
  user: Record<string, unknown> | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  setUser: (user: Record<string, unknown> | null) => void;
  setAuthenticated: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setAuthenticated: () => set({ isAuthenticated: true }),
  setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  logout: () =>
    set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null }),
}));

export const useBlocksAuthStore = useAuthStore;

interface ImpersonateState {
  isImpersonated: boolean;
  isInitialized: boolean;
  originalTenantId: string | null;
  impersonatedTenantId: string | null;
  setImpersonation: (
    impersonated: boolean,
    originalTenantId: string | null,
    impersonatedTenantId: string | null,
  ) => void;
  setInitialized: (value: boolean) => void;
  impersonate: (tenantId: string, key: string) => void;
  terminate: (key: string) => void;
}

export const useImpersonateStore = create<ImpersonateState>((set) => ({
  isImpersonated: false,
  isInitialized: false,
  originalTenantId: null,
  impersonatedTenantId: null,
  setImpersonation: (isImpersonated, originalTenantId, impersonatedTenantId) =>
    set({ isImpersonated, originalTenantId, impersonatedTenantId }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  impersonate: (tenantId) =>
    set({ isImpersonated: true, impersonatedTenantId: tenantId }),
  terminate: () =>
    set({ isImpersonated: false, impersonatedTenantId: null }),
}));

interface AppSettingsState {
  settings: { theme: string; [key: string]: unknown };
  setSettings: (settings: Partial<{ theme: string }>) => void;
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  settings: { theme: "system" },
  setSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),
}));
