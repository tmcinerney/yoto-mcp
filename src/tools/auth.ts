import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { fetchUserInfo, initiateDeviceCode, pollForToken } from '../auth/device-code-flow.js';
import type { TokenStore } from '../auth/token-store.js';
import type { AuthConfig } from '../auth/types.js';
import { toolError, toolResult } from './shared.js';

// Pending device codes stored in memory — lost on server restart
const pendingDeviceCodes = new Map<
  string,
  { deviceCode: string; interval: number; expiresIn: number; createdAt: number }
>();

export async function handleAuth(
  _store: TokenStore,
  authConfig: AuthConfig,
): Promise<CallToolResult> {
  try {
    const deviceCode = await initiateDeviceCode(authConfig);

    // Store the device code for the poll phase
    pendingDeviceCodes.set(deviceCode.user_code, {
      deviceCode: deviceCode.device_code,
      interval: deviceCode.interval,
      expiresIn: deviceCode.expires_in,
      createdAt: Date.now(),
    });

    return toolResult({
      message: 'Please authorize in your browser, then call yoto_auth_complete with the user_code.',
      verificationUrl: deviceCode.verification_uri_complete,
      userCode: deviceCode.user_code,
      expiresInSeconds: deviceCode.expires_in,
    });
  } catch (err) {
    return toolError(`Authentication failed: ${(err as Error).message}`);
  }
}

interface AuthCompleteArgs {
  userCode: string;
}

export async function handleAuthComplete(
  store: TokenStore,
  authConfig: AuthConfig,
  args: AuthCompleteArgs,
): Promise<CallToolResult> {
  try {
    const pending = pendingDeviceCodes.get(args.userCode);
    if (!pending) {
      return toolError(
        `No pending authentication for user code '${args.userCode}'. Call yoto_auth first.`,
      );
    }

    // Check if expired
    const elapsed = (Date.now() - pending.createdAt) / 1000;
    if (elapsed >= pending.expiresIn) {
      pendingDeviceCodes.delete(args.userCode);
      return toolError('Device code expired. Please call yoto_auth again.');
    }

    const remainingExpiry = Math.ceil(pending.expiresIn - elapsed);

    const pollResult = await pollForToken(
      authConfig,
      pending.deviceCode,
      pending.interval,
      remainingExpiry,
    );

    pendingDeviceCodes.delete(args.userCode);

    if (pollResult.status !== 'success') {
      return toolError(`Authentication ${pollResult.status}: ${pollResult.message}`);
    }

    const { tokens } = pollResult;
    const userInfo = await fetchUserInfo(authConfig.authDomain, tokens.access_token);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // AIDEV-NOTE: Device code flow always returns refresh_token (unlike refresh grant)
    if (!tokens.refresh_token) {
      return toolError('Authentication succeeded but no refresh token was returned. Please try again.');
    }

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
