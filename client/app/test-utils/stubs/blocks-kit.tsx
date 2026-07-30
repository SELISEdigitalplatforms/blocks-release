/**
 * Test-only double for the `@seliseblocks/genesis-os` barrel.
 *
 * The real package's barrel eagerly imports framer-motion (whose motion-utils
 * reads process.env.NODE_ENV at import time) and instantiates a signalr-backed
 * NotificationListenerService that reads runtime env at construction. Both crash
 * under the jsdom test environment. Aliasing the package to this double (see
 * vitest.config.ts) keeps the heavy design-system out of the test module graph
 * while still providing the exports app modules under test rely on.
 *
 * Layout / route / guard components are rendered as transparent passthroughs so
 * the app code around them still executes. Project / auth state comes from the
 * shared stub stores so selectors return usable values.
 */
import React from "react";
import { Outlet } from "react-router";

export {
  useProjectStore,
  useAuthStore,
  useBlocksAuthStore,
  useImpersonateStore,
} from "./blocks-kit-stores";
export type { StubProject as ProjectStoreState } from "./blocks-kit-stores";

type PassthroughProps = { children?: React.ReactNode } & Record<string, unknown>;

const passthrough = (label: string) => {
  const Component = ({ children }: PassthroughProps) =>
    React.createElement(React.Fragment, null, children);
  Component.displayName = label;
  return Component;
};

type HttpClientOptions = {
  baseURL?: string | (() => string);
  blocksKey?: string | (() => string);
};

export class HttpClient {
  baseURL: HttpClientOptions["baseURL"];
  blocksKey: HttpClientOptions["blocksKey"];

  constructor(options: HttpClientOptions = {}) {
    this.baseURL = options.baseURL ?? "";
    this.blocksKey = options.blocksKey ?? "";
  }

  get<T = unknown>(): Promise<T> {
    return Promise.resolve(undefined as T);
  }
  post<T = unknown>(): Promise<T> {
    return Promise.resolve(undefined as T);
  }
  put<T = unknown>(): Promise<T> {
    return Promise.resolve(undefined as T);
  }
  patch<T = unknown>(): Promise<T> {
    return Promise.resolve(undefined as T);
  }
  delete<T = unknown>(): Promise<T> {
    return Promise.resolve(undefined as T);
  }
  stream<T = unknown>(): Promise<T> {
    return Promise.resolve(undefined as T);
  }
}

export class HttpError extends Error {
  status: number;
  errors: Record<string, string | string[]>;
  constructor(status = 0, errors: Record<string, string | string[]> = {}) {
    super(`HttpError ${status}`);
    this.status = status;
    this.errors = errors;
  }
}

export { Outlet };

export const BlocksAppLayout = passthrough("BlocksAppLayout");
export const TooltipProvider = passthrough("TooltipProvider");
export const ConsoleLayout = passthrough("ConsoleLayout");
export const ConsolePage = passthrough("ConsolePage");
export const DashboardLayout = passthrough("DashboardLayout");
export const DashboardOverview = passthrough("DashboardOverview");
export const DashboardRoute = passthrough("DashboardRoute");
export const ProjectOverviewLayout = passthrough("ProjectOverviewLayout");
export const ProjectOverviewRoute = passthrough("ProjectOverviewRoute");
export const LoginPage = passthrough("LoginPage");
export const CallbackPage = passthrough("CallbackPage");
export const ProfilePage = passthrough("ProfilePage");
export const AuthResolver = passthrough("AuthResolver");
export const ProtectedGuard = passthrough("ProtectedGuard");
export const PublicGuard = passthrough("PublicGuard");
export const AppSwitcher = passthrough("AppSwitcher");
export const ThemeSwitcher = passthrough("ThemeSwitcher");
export const UserDropdownMenu = passthrough("UserDropdownMenu");
export const EnvironmentCard = passthrough("EnvironmentCard");
