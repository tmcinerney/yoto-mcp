import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createYotoSdk, type YotoSdk } from '@yotoplay/yoto-sdk';
import { ensureFreshToken } from '../auth/token-refresh.js';
import type { TokenStore } from '../auth/token-store.js';
import type { AuthConfig } from '../auth/types.js';

type SdkResult = { sdk: YotoSdk; account: { userId: string; email: string } } | { error: string };

// SDK instances cached per account, invalidated on token refresh
export class ToolContext {
  private sdkCache = new Map<string, { sdk: YotoSdk; token: string }>();

  constructor(
    readonly store: TokenStore,
    readonly authConfig: AuthConfig,
  ) {}

  async getSdk(accountId?: string): Promise<SdkResult> {
    const account = await this.store.getAccount(accountId);
    if (!account) {
      return {
        error: accountId
          ? `Account '${accountId}' not found`
          : 'No accounts configured. Use yoto_auth to authenticate.',
      };
    }

    // Update lastUsed timestamp — awaited to prevent race conditions on cleanup
    await this.store.touchAccount(account.userId).catch(() => {});

    // Always check token freshness — cached SDK may have expired JWT
    const token = await ensureFreshToken(this.authConfig, this.store, account.userId);
    if (!token) {
      return {
        error: `Failed to refresh token for '${account.email}'. Re-authenticate with yoto_auth.`,
      };
    }

    const cached = this.sdkCache.get(account.userId);
    if (cached && cached.token === token) {
      return { sdk: cached.sdk, account: { userId: account.userId, email: account.email } };
    }

    // Token changed or no cache — create new SDK instance
    const sdk = createYotoSdk({ jwt: token });
    this.sdkCache.set(account.userId, { sdk, token });
    return { sdk, account: { userId: account.userId, email: account.email } };
  }

  invalidateSdk(accountId: string): void {
    this.sdkCache.delete(accountId);
  }
}

export function toolError(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function toolResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/** Extract HTTP status code from axios-style errors thrown by the Yoto SDK */
function getStatusCode(err: unknown): number | undefined {
  const e = err as { response?: { status?: number }; status?: number };
  return e.response?.status ?? e.status;
}

/**
 * Classify API errors and return actionable messages.
 * - 401/403: token expired or revoked — prompt re-auth
 * - 429: rate limited — include retry guidance
 * - Other: pass through original message
 */
export function classifyApiError(operation: string, err: unknown): string {
  const status = getStatusCode(err);
  const base = err instanceof Error ? err.message : String(err);

  switch (status) {
    case 401:
    case 403:
      return `${operation}: Authentication failed (${status}). Token may be expired or revoked. Re-authenticate with yoto_auth.`;
    case 429:
      return `${operation}: Rate limited by Yoto API (429). Wait a moment and try again.`;
    case 404:
      return `${operation}: Resource not found (404).`;
    default:
      return `${operation}: ${base}`;
  }
}
