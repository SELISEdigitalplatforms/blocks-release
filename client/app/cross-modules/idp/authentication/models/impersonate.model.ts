export interface ImpersonationRequest {
  TargetTenantId: string;
  orgId?: string;
  organizationId?: string;
}

export interface ImpersonationStatusResponse {
  impersonated: boolean;
  originalTenantId: string;
  impersonatedTenantId: string | null;
}

export interface ImpersonationState {
  rootTenantId: string;
  TargetTenantId: string;
  orgId: string;
  startedAtUtc: string;
}
