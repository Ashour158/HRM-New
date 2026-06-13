export interface ApiResponse<TData> {
  success: boolean;
  data: TData;
  correlationId?: string;
}

export interface AuthPermissionResponse {
  id: string;
  resource: string;
  action: string;
}

export interface AuthRoleResponse {
  id: string;
  name: string;
  description?: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  roles: AuthRoleResponse[];
  permissions: AuthPermissionResponse[];
}

export interface AuthSessionResponse {
  sessionId: string;
  userId: string;
  tenantId: string;
  createdAt: string;
  expiresAt: string;
  mfaAuthenticated: boolean;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
  tenantId?: string;
}

export interface AuthLoginResponse {
  user: AuthUserResponse;
  token: string;
  refreshToken?: string;
  session?: AuthSessionResponse;
}

export interface AuthRefreshRequest {
  refreshToken: string;
}

export interface AuthRefreshResponse {
  token: string;
  refreshToken?: string;
  session?: AuthSessionResponse;
}

export interface AuthRegisterRequest {
  tenantId?: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export type AuthRegisterResponse = AuthLoginResponse;

export interface AuthPasswordResetRequest {
  tenantId?: string;
  email: string;
}

export interface AuthPasswordResetRequestResponse {
  ok: true;
  resetToken?: string;
  expiresAt?: string;
}

export interface AuthPasswordResetConfirmRequest {
  token: string;
  password: string;
}

export interface AuthPasswordResetConfirmResponse {
  ok: true;
}

export interface AuthMfaSetupResponse {
  provisioningUri: string;
  qrCodeDataUrl: string;
}

export interface AuthMfaVerifyRequest {
  code: string;
}

export type AuthMfaVerifyResponse = AuthRefreshResponse;

export interface AuthProvidersResponse {
  local: { enabled: boolean };
  oidc: {
    enabled: boolean;
    issuerUrl?: string;
    clientId?: string;
    redirectUri?: string;
  };
  saml: {
    enabled: boolean;
    metadataUrl?: string;
    entityId?: string;
  };
  mfa: {
    required: boolean;
  };
  session: {
    accessTokenTtl: string;
    refreshTokenTtl: string;
  };
}
