import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenStore } from '../../src/auth/token-store.js';
import type { AccountRecord, AuthConfig } from '../../src/auth/types.js';
import { handleAccounts, handleAuth, handleAuthComplete } from '../../src/tools/auth.js';

vi.mock('../../src/auth/device-code-flow.js', () => ({
  initiateDeviceCode: vi.fn(),
  pollForToken: vi.fn(),
  fetchUserInfo: vi.fn(),
}));

import {
  fetchUserInfo,
  initiateDeviceCode,
  pollForToken,
} from '../../src/auth/device-code-flow.js';

const AUTH_CONFIG: AuthConfig = {
  clientId: 'test-client-id',
  clientSecret: undefined,
  authDomain: 'login.yotoplay.com',
  audience: 'https://api.yotoplay.com',
};

function makeAccount(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    userId: 'user-1',
    email: 'trav@example.com',
    displayName: 'Trav',
    accessToken: 'access-token-1',
    refreshToken: 'refresh-token-1',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    lastUsed: new Date().toISOString(),
    ...overrides,
  };
}

describe('handleAuth', () => {
  let configDir: string;
  let store: TokenStore;

  beforeEach(async () => {
    configDir = join(
      tmpdir(),
      `yoto-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    store = new TokenStore(configDir);
    await store.load();

    vi.mocked(initiateDeviceCode).mockClear();
    vi.mocked(pollForToken).mockClear();
    vi.mocked(fetchUserInfo).mockClear();
  });

  afterEach(async () => {
    await rm(configDir, { recursive: true, force: true });
  });

  it('returns verification URL and user code without blocking', async () => {
    vi.mocked(initiateDeviceCode).mockResolvedValue({
      device_code: 'dev-123',
      user_code: 'ABCD-EFGH',
      verification_uri: 'https://login.yotoplay.com/activate',
      verification_uri_complete: 'https://login.yotoplay.com/activate?user_code=ABCD-EFGH',
      expires_in: 300,
      interval: 5,
    });

    const result = await handleAuth(store, AUTH_CONFIG);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.verificationUrl).toBe('https://login.yotoplay.com/activate?user_code=ABCD-EFGH');
    expect(data.userCode).toBe('ABCD-EFGH');
    expect(data.expiresInSeconds).toBe(300);

    // Should NOT have called pollForToken — that's handleAuthComplete's job
    expect(pollForToken).not.toHaveBeenCalled();
  });

  it('returns error when device code initiation fails', async () => {
    vi.mocked(initiateDeviceCode).mockRejectedValue(new Error('unauthorized_client'));

    const result = await handleAuth(store, AUTH_CONFIG);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('unauthorized_client');
  });
});

describe('handleAuthComplete', () => {
  let configDir: string;
  let store: TokenStore;

  beforeEach(async () => {
    configDir = join(
      tmpdir(),
      `yoto-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    store = new TokenStore(configDir);
    await store.load();

    vi.mocked(initiateDeviceCode).mockClear();
    vi.mocked(pollForToken).mockClear();
    vi.mocked(fetchUserInfo).mockClear();
  });

  afterEach(async () => {
    await rm(configDir, { recursive: true, force: true });
  });

  it('completes auth flow and saves account', async () => {
    // First, initiate the flow to store pending device code
    vi.mocked(initiateDeviceCode).mockResolvedValue({
      device_code: 'dev-123',
      user_code: 'WXYZ-1234',
      verification_uri: 'https://login.yotoplay.com/activate',
      verification_uri_complete: 'https://login.yotoplay.com/activate?user_code=WXYZ-1234',
      expires_in: 300,
      interval: 5,
    });
    await handleAuth(store, AUTH_CONFIG);

    // Now complete the flow
    vi.mocked(pollForToken).mockResolvedValue({
      status: 'success',
      tokens: {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        token_type: 'Bearer',
        expires_in: 86400,
      },
    });

    vi.mocked(fetchUserInfo).mockResolvedValue({
      sub: 'auth0|user-new',
      email: 'new@example.com',
      name: 'New User',
    });

    const result = await handleAuthComplete(store, AUTH_CONFIG, { userCode: 'WXYZ-1234' });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.email).toBe('new@example.com');

    // Account should be saved to store
    const account = store.getAccount('auth0|user-new');
    expect(account).toBeDefined();
    expect(account?.email).toBe('new@example.com');
  });

  it('returns error for unknown user code', async () => {
    const result = await handleAuthComplete(store, AUTH_CONFIG, { userCode: 'NOPE-1234' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No pending authentication');
  });

  it('returns error when device code flow is denied', async () => {
    vi.mocked(initiateDeviceCode).mockResolvedValue({
      device_code: 'dev-123',
      user_code: 'DENY-CODE',
      verification_uri: 'https://login.yotoplay.com/activate',
      verification_uri_complete: 'https://login.yotoplay.com/activate?user_code=DENY-CODE',
      expires_in: 300,
      interval: 5,
    });
    await handleAuth(store, AUTH_CONFIG);

    vi.mocked(pollForToken).mockResolvedValue({
      status: 'denied',
      message: 'User denied access',
    });

    const result = await handleAuthComplete(store, AUTH_CONFIG, { userCode: 'DENY-CODE' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('denied');
  });

  it('returns error when device code flow expires', async () => {
    vi.mocked(initiateDeviceCode).mockResolvedValue({
      device_code: 'dev-123',
      user_code: 'EXPR-CODE',
      verification_uri: 'https://login.yotoplay.com/activate',
      verification_uri_complete: 'https://login.yotoplay.com/activate?user_code=EXPR-CODE',
      expires_in: 300,
      interval: 5,
    });
    await handleAuth(store, AUTH_CONFIG);

    vi.mocked(pollForToken).mockResolvedValue({
      status: 'expired',
      message: 'Code expired',
    });

    const result = await handleAuthComplete(store, AUTH_CONFIG, { userCode: 'EXPR-CODE' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('expired');
  });
});

describe('handleAccounts', () => {
  let configDir: string;
  let store: TokenStore;

  beforeEach(async () => {
    configDir = join(
      tmpdir(),
      `yoto-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    store = new TokenStore(configDir);
    await store.load();
  });

  afterEach(async () => {
    await rm(configDir, { recursive: true, force: true });
  });

  it('lists accounts with default indicator', async () => {
    await store.setAccount(makeAccount());
    await store.setAccount(
      makeAccount({ userId: 'user-2', email: 'other@example.com', displayName: 'Other' }),
    );

    const result = await handleAccounts(store, { action: 'list' });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.accounts).toHaveLength(2);
    expect(data.defaultAccount).toBe('user-1');
  });

  it('returns empty list when no accounts', async () => {
    const result = await handleAccounts(store, { action: 'list' });

    const data = JSON.parse(result.content[0].text);
    expect(data.accounts).toHaveLength(0);
    expect(data.defaultAccount).toBeNull();
  });

  it('switches default account', async () => {
    await store.setAccount(makeAccount());
    await store.setAccount(makeAccount({ userId: 'user-2', email: 'other@example.com' }));

    const result = await handleAccounts(store, { action: 'switch', accountId: 'user-2' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('user-2');

    const account = store.getAccount();
    expect(account?.userId).toBe('user-2');
  });

  it('returns error when switching to nonexistent account', async () => {
    const result = await handleAccounts(store, { action: 'switch', accountId: 'nope' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('nope');
  });

  it('removes an account', async () => {
    await store.setAccount(makeAccount());

    const result = await handleAccounts(store, { action: 'remove', accountId: 'user-1' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('removed');

    const account = store.getAccount('user-1');
    expect(account).toBeUndefined();
  });

  it('returns error when removing nonexistent account', async () => {
    const result = await handleAccounts(store, { action: 'remove', accountId: 'nope' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('nope');
  });
});
