import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureFreshToken,
  refreshAccessToken,
  refreshAccount,
  refreshExpiringAccounts,
  startPeriodicRefresh,
} from '../../src/auth/token-refresh.js';
import { TokenStore } from '../../src/auth/token-store.js';
import type { AuthConfig } from '../../src/auth/types.js';

const AUTH_CONFIG: AuthConfig = {
  clientId: 'test-client-id',
  clientSecret: undefined,
  authDomain: 'login.yotoplay.com',
  audience: 'https://api.yotoplay.com',
};

const FRESH_TOKEN_RESPONSE = {
  access_token: 'new-access-token',
  refresh_token: 'new-refresh-token',
  token_type: 'Bearer',
  expires_in: 86400,
};

describe('refreshAccessToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct request and returns token response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(FRESH_TOKEN_RESPONSE), { status: 200 }),
    );

    const result = await refreshAccessToken(AUTH_CONFIG, 'old-refresh-token');

    expect(result).toEqual(FRESH_TOKEN_RESPONSE);

    const call = vi.mocked(fetch).mock.calls[0];
    const body = call[1]?.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('old-refresh-token');
    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('client_secret')).toBeNull();
  });

  it('throws on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Invalid grant', { status: 403 }));

    await expect(refreshAccessToken(AUTH_CONFIG, 'bad-token')).rejects.toThrow(
      'Token refresh failed (403)',
    );
  });
});

describe('refreshAccount', () => {
  let configDir: string;
  let store: TokenStore;

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn());
    configDir = join(tmpdir(), `yoto-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    store = new TokenStore(configDir);
    await store.load();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(configDir, { recursive: true, force: true });
  });

  it('refreshes tokens and updates the store', async () => {
    await store.setAccount({
      userId: 'user-1',
      email: 'trav@example.com',
      displayName: 'Trav',
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: new Date(Date.now() - 1000).toISOString(), // expired
      lastUsed: new Date().toISOString(),
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(FRESH_TOKEN_RESPONSE), { status: 200 }),
    );

    const result = await refreshAccount(AUTH_CONFIG, store, 'user-1');

    expect(result).toBe('new-access-token');
    expect(store.getAccount('user-1')?.accessToken).toBe('new-access-token');
    expect(store.getAccount('user-1')?.refreshToken).toBe('new-refresh-token');
  });

  it('returns null for nonexistent account', async () => {
    const result = await refreshAccount(AUTH_CONFIG, store, 'nonexistent');
    expect(result).toBeNull();
  });

  it('returns null and logs on refresh failure', async () => {
    await store.setAccount({
      userId: 'user-1',
      email: 'trav@example.com',
      displayName: 'Trav',
      accessToken: 'old-access',
      refreshToken: 'revoked-refresh',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      lastUsed: new Date().toISOString(),
    });

    vi.mocked(fetch).mockResolvedValue(new Response('Invalid grant', { status: 403 }));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await refreshAccount(AUTH_CONFIG, store, 'user-1');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('refreshExpiringAccounts', () => {
  let configDir: string;
  let store: TokenStore;

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn());
    configDir = join(tmpdir(), `yoto-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    store = new TokenStore(configDir);
    await store.load();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(configDir, { recursive: true, force: true });
  });

  it('refreshes only accounts expiring within the window', async () => {
    // Expires in 30 min — should refresh
    await store.setAccount({
      userId: 'user-expiring',
      email: 'expiring@example.com',
      displayName: 'Expiring',
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      lastUsed: new Date().toISOString(),
    });

    // Expires in 12 hours — should NOT refresh
    await store.setAccount({
      userId: 'user-fresh',
      email: 'fresh@example.com',
      displayName: 'Fresh',
      accessToken: 'fresh-access',
      refreshToken: 'fresh-refresh',
      expiresAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
      lastUsed: new Date().toISOString(),
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(FRESH_TOKEN_RESPONSE), { status: 200 }),
    );

    const refreshed = await refreshExpiringAccounts(AUTH_CONFIG, store);

    expect(refreshed).toEqual(['user-expiring']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('ensureFreshToken', () => {
  let configDir: string;
  let store: TokenStore;

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn());
    configDir = join(tmpdir(), `yoto-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    store = new TokenStore(configDir);
    await store.load();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(configDir, { recursive: true, force: true });
  });

  it('returns existing token when not near expiry', async () => {
    await store.setAccount({
      userId: 'user-1',
      email: 'trav@example.com',
      displayName: 'Trav',
      accessToken: 'valid-access',
      refreshToken: 'valid-refresh',
      expiresAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
      lastUsed: new Date().toISOString(),
    });

    const token = await ensureFreshToken(AUTH_CONFIG, store, 'user-1');

    expect(token).toBe('valid-access');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refreshes and returns new token when near expiry', async () => {
    await store.setAccount({
      userId: 'user-1',
      email: 'trav@example.com',
      displayName: 'Trav',
      accessToken: 'stale-access',
      refreshToken: 'valid-refresh',
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), // 10 min left
      lastUsed: new Date().toISOString(),
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(FRESH_TOKEN_RESPONSE), { status: 200 }),
    );

    const token = await ensureFreshToken(AUTH_CONFIG, store, 'user-1');

    expect(token).toBe('new-access-token');
  });

  it('returns null for nonexistent account', async () => {
    const token = await ensureFreshToken(AUTH_CONFIG, store, 'nonexistent');
    expect(token).toBeNull();
  });
});

describe('startPeriodicRefresh', () => {
  let configDir: string;
  let store: TokenStore;

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn());
    configDir = join(tmpdir(), `yoto-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    store = new TokenStore(configDir);
    await store.load();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(configDir, { recursive: true, force: true });
  });

  it('runs immediately on startup and calls onRefresh callback', async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(FRESH_TOKEN_RESPONSE), { status: 200 })),
    );

    await store.setAccount({
      userId: 'user-1',
      email: 'trav@example.com',
      displayName: 'Trav',
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      lastUsed: new Date().toISOString(),
    });

    const onRefresh = vi.fn();
    const cleanup = startPeriodicRefresh(AUTH_CONFIG, store, onRefresh);

    // Wait for the immediate startup refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onRefresh).toHaveBeenCalledWith(['user-1']);

    cleanup();
  });

  it('returns a cleanup function', async () => {
    const cleanup = startPeriodicRefresh(AUTH_CONFIG, store);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });
});
