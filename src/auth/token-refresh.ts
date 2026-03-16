import type { TokenStore } from './token-store.js';
import type { AuthConfig, TokenResponse } from './types.js';

/** Refresh an access token using a refresh token via Auth0 */
export async function refreshAccessToken(
  config: AuthConfig,
  refreshToken: string,
): Promise<TokenResponse> {
  const url = `https://${config.authDomain}/oauth/token`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  return (await response.json()) as TokenResponse;
}

// AIDEV-NOTE: Proactive refresh window — 1 hour before expiry
const REFRESH_WINDOW_MS = 60 * 60 * 1000;

// AIDEV-NOTE: Periodic refresh interval — scans every 15 minutes
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Refresh a single account's tokens and update the store.
 * Returns the new access token, or null if refresh failed.
 */
export async function refreshAccount(
  config: AuthConfig,
  store: TokenStore,
  accountId: string,
): Promise<string | null> {
  const account = store.getAccount(accountId);
  if (!account) return null;

  try {
    const tokens = await refreshAccessToken(config, account.refreshToken);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await store.updateTokens(accountId, tokens.access_token, tokens.refresh_token, expiresAt);

    return tokens.access_token;
  } catch (err) {
    console.error(`Failed to refresh token for account ${accountId}:`, err);
    return null;
  }
}

/**
 * Scan all accounts and refresh any tokens expiring within the refresh window.
 * Returns a list of account IDs that were refreshed.
 */
export async function refreshExpiringAccounts(
  config: AuthConfig,
  store: TokenStore,
): Promise<string[]> {
  const expiring = store.getExpiringAccounts(REFRESH_WINDOW_MS);
  const refreshed: string[] = [];

  for (const account of expiring) {
    const result = await refreshAccount(config, store, account.userId);
    if (result) {
      refreshed.push(account.userId);
    }
  }

  return refreshed;
}

/**
 * Start a periodic refresh timer that scans for expiring tokens.
 * Returns a cleanup function to stop the timer.
 */
export function startPeriodicRefresh(
  config: AuthConfig,
  store: TokenStore,
  onRefresh?: (accountIds: string[]) => void,
): () => void {
  // Run immediately on startup
  void refreshExpiringAccounts(config, store).then((ids) => {
    if (ids.length > 0) onRefresh?.(ids);
  });

  const timer = setInterval(() => {
    void refreshExpiringAccounts(config, store).then((ids) => {
      if (ids.length > 0) onRefresh?.(ids);
    });
  }, REFRESH_INTERVAL_MS);

  return () => clearInterval(timer);
}

/**
 * Check if an account's token is expired or near-expiry, and refresh if needed.
 * Used as an on-demand fallback before API calls.
 */
export async function ensureFreshToken(
  config: AuthConfig,
  store: TokenStore,
  accountId: string,
): Promise<string | null> {
  const account = store.getAccount(accountId);
  if (!account) return null;

  const expiresAt = new Date(account.expiresAt).getTime();
  const isExpired = expiresAt < Date.now() + REFRESH_WINDOW_MS;

  if (!isExpired) {
    return account.accessToken;
  }

  return refreshAccount(config, store, accountId);
}
