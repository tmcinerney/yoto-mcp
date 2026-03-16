import type {
  AuthConfig,
  DeviceCodeResponse,
  TokenErrorResponse,
  TokenResponse,
  UserInfo,
} from './types.js';

/** Initiate the Auth0 device code flow. Returns codes for the user to authorize. */
export async function initiateDeviceCode(config: AuthConfig): Promise<DeviceCodeResponse> {
  const url = `https://${config.authDomain}/oauth/device/code`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      scope: 'openid profile email offline_access',
      audience: config.audience,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Device code request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as DeviceCodeResponse;
}

export type PollResult =
  | { status: 'success'; tokens: TokenResponse }
  | { status: 'expired'; message: string }
  | { status: 'denied'; message: string };

/**
 * Poll Auth0 for token exchange until the user authorizes, the code expires,
 * or authorization is denied.
 *
 * Uses the interval from the device code response to avoid rate limiting.
 * Backs off on `slow_down` errors per spec.
 */
export async function pollForToken(
  config: AuthConfig,
  deviceCode: string,
  interval: number,
  expiresIn: number,
  signal?: AbortSignal,
): Promise<PollResult> {
  const url = `https://${config.authDomain}/oauth/token`;
  const deadline = Date.now() + expiresIn * 1000;
  let pollInterval = interval * 1000;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error('Device code polling aborted');
    }

    await sleep(pollInterval);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_id: config.clientId,
          device_code: deviceCode,
          audience: config.audience,
        }),
        signal,
      });

      if (response.ok) {
        const tokens = (await response.json()) as TokenResponse;
        return { status: 'success', tokens };
      }

      const error = (await response.json()) as TokenErrorResponse;

      switch (error.error) {
        case 'authorization_pending':
          // User hasn't authorized yet — keep polling
          continue;
        case 'slow_down':
          // Back off by 5 seconds per spec
          pollInterval += 5000;
          continue;
        case 'expired_token':
          return { status: 'expired', message: 'Device code expired. Please try again.' };
        case 'access_denied':
          return { status: 'denied', message: 'Authorization was denied by the user.' };
        default:
          throw new Error(`Unexpected auth error: ${error.error} — ${error.error_description}`);
      }
    } catch (err) {
      // Network errors (DNS failure, connection reset) — retry until deadline
      if (err instanceof TypeError || (err instanceof Error && err.message.includes('fetch'))) {
        continue;
      }
      // Re-throw non-network errors (unexpected auth errors, abort)
      throw err;
    }
  }

  return { status: 'expired', message: 'Device code expired. Please try again.' };
}

/** Fetch user profile from Auth0 using an access token */
export async function fetchUserInfo(authDomain: string, accessToken: string): Promise<UserInfo> {
  const url = `https://${authDomain}/userinfo`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch user info (${response.status}): ${body}`);
  }

  return (await response.json()) as UserInfo;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
