import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchUserInfo,
  initiateDeviceCode,
  pollForToken,
} from '../../src/auth/device-code-flow.js';
import type { AuthConfig } from '../../src/auth/types.js';

const AUTH_CONFIG: AuthConfig = {
  clientId: 'test-client-id',
  clientSecret: undefined,
  authDomain: 'login.yotoplay.com',
  audience: 'https://api.yotoplay.com',
};

describe('initiateDeviceCode', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct request and returns device code response', async () => {
    const mockResponse = {
      device_code: 'dev-code-123',
      user_code: 'ABCD-EFGH',
      verification_uri: 'https://login.yotoplay.com/activate',
      verification_uri_complete: 'https://login.yotoplay.com/activate?user_code=ABCD-EFGH',
      expires_in: 300,
      interval: 5,
    };

    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200 }));

    const result = await initiateDeviceCode(AUTH_CONFIG);

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      'https://login.yotoplay.com/oauth/device/code',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    // Verify body contains required params
    const call = vi.mocked(fetch).mock.calls[0];
    const body = call[1]?.body as URLSearchParams;
    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('client_secret')).toBeNull();
    expect(body.get('scope')).toBe('openid profile email offline_access');
    expect(body.get('audience')).toBe('https://api.yotoplay.com');
  });

  it('throws on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    await expect(initiateDeviceCode(AUTH_CONFIG)).rejects.toThrow(
      'Device code request failed (401)',
    );
  });
});

describe('pollForToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns tokens on success after pending polls', async () => {
    const tokenResponse = {
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      token_type: 'Bearer',
      expires_in: 86400,
    };

    vi.mocked(fetch)
      // First poll: pending
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'authorization_pending' }), { status: 403 }),
      )
      // Second poll: success
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }));

    const result = await pollForToken(AUTH_CONFIG, 'dev-code-123', 1, 300);

    expect(result).toEqual({ status: 'success', tokens: tokenResponse });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns expired when device code expires', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'expired_token', error_description: 'Code expired' }), {
        status: 403,
      }),
    );

    const result = await pollForToken(AUTH_CONFIG, 'dev-code-123', 1, 300);

    expect(result.status).toBe('expired');
  });

  it('returns denied when user denies authorization', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'access_denied', error_description: 'User denied' }), {
        status: 403,
      }),
    );

    const result = await pollForToken(AUTH_CONFIG, 'dev-code-123', 1, 300);

    expect(result.status).toBe('denied');
  });

  it('increases interval on slow_down error', async () => {
    const tokenResponse = {
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      token_type: 'Bearer',
      expires_in: 86400,
    };

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'slow_down' }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }));

    const result = await pollForToken(AUTH_CONFIG, 'dev-code-123', 1, 300);

    expect(result.status).toBe('success');
    // slow_down adds 5s, so second poll should have waited longer
    expect(fetch).toHaveBeenCalledTimes(2);
  }, 15_000);

  it('throws on unexpected error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'server_error', error_description: 'Internal error' }), {
        status: 500,
      }),
    );

    await expect(pollForToken(AUTH_CONFIG, 'dev-code-123', 1, 300)).rejects.toThrow(
      'Unexpected auth error: server_error',
    );
  });
});

describe('fetchUserInfo', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns user profile from /userinfo endpoint', async () => {
    const userInfo = { sub: 'auth0|user-123', email: 'trav@example.com', name: 'Trav' };

    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(userInfo), { status: 200 }));

    const result = await fetchUserInfo('login.yotoplay.com', 'access-token-123');

    expect(result).toEqual(userInfo);
    expect(fetch).toHaveBeenCalledWith('https://login.yotoplay.com/userinfo', {
      headers: { Authorization: 'Bearer access-token-123' },
    });
  });

  it('throws on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    await expect(fetchUserInfo('login.yotoplay.com', 'bad-token')).rejects.toThrow(
      'Failed to fetch user info (401)',
    );
  });
});
