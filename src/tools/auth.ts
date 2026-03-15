import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { fetchUserInfo, initiateDeviceCode, pollForToken } from '../auth/device-code-flow.js';
import type { TokenStore } from '../auth/token-store.js';
import type { AuthConfig } from '../auth/types.js';
import { toolError, toolResult } from './shared.js';

export async function handleAuth(
  store: TokenStore,
  authConfig: AuthConfig,
): Promise<CallToolResult> {
  try {
    const deviceCode = await initiateDeviceCode(authConfig);

    const pollResult = await pollForToken(
      authConfig,
      deviceCode.device_code,
      deviceCode.interval,
      deviceCode.expires_in,
    );

    if (pollResult.status !== 'success') {
      return toolError(`Authentication ${pollResult.status}: ${pollResult.message}`);
    }

    const tokens = pollResult.tokens!;
    const userInfo = await fetchUserInfo(authConfig.authDomain, tokens.access_token);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await store.setAccount({
      userId: userInfo.sub,
      email: userInfo.email,
      displayName: userInfo.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      lastUsed: new Date().toISOString(),
    });

    return toolResult({
      message: `Authenticated as ${userInfo.email} (${userInfo.name})`,
      userId: userInfo.sub,
      email: userInfo.email,
    });
  } catch (err) {
    return toolError(`Authentication failed: ${(err as Error).message}`);
  }
}

interface AccountsArgs {
  action: 'list' | 'switch' | 'remove';
  accountId?: string;
}

export async function handleAccounts(
  store: TokenStore,
  args: AccountsArgs,
): Promise<CallToolResult> {
  try {
    switch (args.action) {
      case 'list': {
        const allAccounts = store.getAccounts();
        const accounts = Object.values(allAccounts).map((a) => ({
          userId: a.userId,
          email: a.email,
          displayName: a.displayName,
          lastUsed: a.lastUsed,
        }));
        return toolResult({
          defaultAccount: store.getDefaultAccountId(),
          accounts,
        });
      }

      case 'switch': {
        if (!args.accountId) {
          return toolError('accountId is required for switch action');
        }
        const account = await store.getAccount(args.accountId);
        if (!account) {
          return toolError(`Account '${args.accountId}' not found`);
        }
        await store.setDefaultAccount(args.accountId);
        return toolResult({
          message: `Default account switched to ${account.email}`,
          defaultAccount: args.accountId,
        });
      }

      case 'remove': {
        if (!args.accountId) {
          return toolError('accountId is required for remove action');
        }
        const account = await store.getAccount(args.accountId);
        if (!account) {
          return toolError(`Account '${args.accountId}' not found`);
        }
        await store.removeAccount(args.accountId);
        return toolResult({
          message: `Account '${args.accountId}' (${account.email}) removed`,
        });
      }

      default:
        return toolError(`Unknown action: ${args.action}`);
    }
  } catch (err) {
    return toolError(`Account operation failed: ${(err as Error).message}`);
  }
}
