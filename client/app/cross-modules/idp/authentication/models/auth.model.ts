export interface ISigninByEmailPayload {
  username: string;
  password: string;
  clientId?: string;
  state?: string;
  nonce?: string;
  scope?: string;
  redirectUri?: string;
}
export interface ISigninByEmailResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}
export interface ISigninByEmailResponse {
  enable_mfa: boolean;
  message: string;
  mfaType: number;
  mfaId: string;
}
