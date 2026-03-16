/** Persisted account record stored in accounts.json */
export interface AccountRecord {
  userId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  /** ISO 8601 timestamp when the access token expires */
  expiresAt: string;
  /** ISO 8601 timestamp of last API usage */
  lastUsed: string;
}

/** Shape of the accounts.json config file */
export interface AccountsFile {
  defaultAccount: string | null;
  accounts: Record<string, AccountRecord>;
}

/** Auth0 device code initiation response */
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

/** Auth0 token exchange response (success) */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string; // Auth0 doesn't always return this on refresh grant
  token_type: string;
  expires_in: number;
}

/** Auth0 token exchange response (pending/error) */
export interface TokenErrorResponse {
  error: string;
  error_description: string;
}

/** User profile from Auth0 /userinfo endpoint */
export interface UserInfo {
  sub: string;
  email: string;
  name: string;
}

/** Auth configuration derived from server config + defaults */
export interface AuthConfig {
  clientId: string;
  authDomain: string;
  audience: string;
}

export const AUTH_DEFAULTS = {
  authDomain: 'login.yotoplay.com',
  audience: 'https://api.yotoplay.com',
} as const;
