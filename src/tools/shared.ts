import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createYotoSdk, type YotoSdk } from '@yotoplay/yoto-sdk';
import { ensureFreshToken } from '../auth/token-refresh.js';
import type { TokenStore } from '../auth/token-store.js';
import type { AuthConfig } from '../auth/types.js';

type SdkResult = { sdk: YotoSdk; account: { userId: string; email: string } } | { error: string };

// SDK instances cached per account, invalidated on token refresh
export class ToolContext {
  private sdkCache = new Map<string, YotoSdk>();

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

    // AIDEV-NOTE: Update lastUsed timestamp — awaited to prevent race conditions on cleanup
    await this.store.touchAccount(account.userId).catch(() => {});

    // AIDEV-NOTE: Always check token freshness — cached SDK may have expired JWT
    const token = await ensureFreshToken(this.authConfig, this.store, account.userId);
    if (!token) {
      return {
        error: `Failed to refresh token for '${account.email}'. Re-authenticate with yoto_auth.`,
      };
    }

    const cached = this.sdkCache.get(account.userId);
    if (cached && account.accessToken === token) {
      return { sdk: cached, account: { userId: account.userId, email: account.email } };
    }

    // Token was refreshed or no cache — create new SDK instance
    const sdk = createYotoSdk({ jwt: token });
    this.sdkCache.set(account.userId, sdk);
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
