export interface ImpersonationRequest {
  targeted_tenant_id: string;
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
  targeted_tenant_id: string;
  orgId: string;
  startedAtUtc: string;
}
