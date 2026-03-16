import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenStore } from '../../src/auth/token-store.js';
import type { AccountRecord, AuthConfig } from '../../src/auth/types.js';
import { ToolContext, toolError, toolResult } from '../../src/tools/shared.js';

vi.mock('@yotoplay/yoto-sdk', () => ({
  createYotoSdk: vi.fn(() => ({ mocked: true })),
}));

vi.mock('../../src/auth/token-refresh.js', () => ({
  ensureFreshToken: vi.fn(),
}));

import { createYotoSdk } from '@yotoplay/yoto-sdk';
import { ensureFreshToken } from '../../src/auth/token-refresh.js';

const AUTH_CONFIG: AuthConfig = {
  clientId: 'test-client-id',
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

describe('toolError', () => {
  it('returns an error result with the given message', () => {
    const result = toolError('Something went wrong');
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Something went wrong' }],
      isError: true,
    });
  });
});

describe('toolResult', () => {
  it('returns a JSON text result', () => {
    const result = toolResult({ cards: [{ id: '1', title: 'Test' }] });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({ cards: [{ id: '1', title: 'Test' }] });
  });

  it('pretty-prints the JSON', () => {
    const result = toolResult({ a: 1 });
    expect(result.content[0].text).toContain('\n');
  });
});

describe('ToolContext', () => {
  let configDir: string;
  let store: TokenStore;
  let ctx: ToolContext;

  beforeEach(async () => {
    configDir = join(
      tmpdir(),
      `yoto-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    store = new TokenStore(configDir);
    await store.load();
    ctx = new ToolContext(store, AUTH_CONFIG);

    vi.mocked(createYotoSdk).mockClear();
    vi.mocked(ensureFreshToken).mockClear();
  });

  afterEach(async () => {
    await rm(configDir, { recursive: true, force: true });
  });

  it('returns an SDK for the default account', async () => {
    const account = makeAccount();
    await store.setAccount(account);
    vi.mocked(ensureFreshToken).mockResolvedValue('fresh-token');

    const result = await ctx.getSdk();
    expect(result).toHaveProperty('sdk');
    if ('sdk' in result) {
      expect(createYotoSdk).toHaveBeenCalledWith(expect.objectContaining({ jwt: 'fresh-token' }));
    }
  });

  it('returns an SDK for a specific account', async () => {
    const account = makeAccount({ userId: 'user-2', email: 'other@example.com' });
    await store.setAccount(account);
    vi.mocked(ensureFreshToken).mockResolvedValue('other-token');

    const result = await ctx.getSdk('user-2');
    expect(result).toHaveProperty('sdk');
    if ('sdk' in result) {
      expect(createYotoSdk).toHaveBeenCalledWith(expect.objectContaining({ jwt: 'other-token' }));
    }
  });

  it('returns an error when no accounts exist', async () => {
    const result = await ctx.getSdk();
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error).toContain('No accounts configured');
    }
  });

  it('returns an error when specified account not found', async () => {
    const account = makeAccount();
    await store.setAccount(account);

    const result = await ctx.getSdk('nonexistent');
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error).toContain('nonexistent');
    }
  });

  it('returns an error when token refresh fails', async () => {
    const account = makeAccount();
    await store.setAccount(account);
    vi.mocked(ensureFreshToken).mockResolvedValue(null);

    const result = await ctx.getSdk();
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error).toContain('refresh');
    }
  });

  it('caches SDK instances per account', async () => {
    const account = makeAccount();
    await store.setAccount(account);
    vi.mocked(ensureFreshToken).mockResolvedValue('fresh-token');

    await ctx.getSdk();
    await ctx.getSdk();
    expect(createYotoSdk).toHaveBeenCalledTimes(1);
  });

  it('recreates SDK when invalidated', async () => {
    const account = makeAccount();
    await store.setAccount(account);
    vi.mocked(ensureFreshToken).mockResolvedValue('fresh-token');

    await ctx.getSdk();
    ctx.invalidateSdk('user-1');

    vi.mocked(ensureFreshToken).mockResolvedValue('newer-token');
    await ctx.getSdk();
    expect(createYotoSdk).toHaveBeenCalledTimes(2);
    expect(createYotoSdk).toHaveBeenLastCalledWith(expect.objectContaining({ jwt: 'newer-token' }));
  });

  // --- Batch 3: touchAccount wiring ---
  // NOTE: Issue 6 (touchAccount never called) is already fixed in source.
  // getSdk already calls `void this.store.touchAccount(account.userId)` on line 29.
  // Test below verifies the existing behavior rather than exposing a bug.

  it('calls touchAccount after successful SDK retrieval', async () => {
    const account = makeAccount();
    await store.setAccount(account);
    vi.mocked(ensureFreshToken).mockResolvedValue('fresh-token');

    const touchSpy = vi.spyOn(store, 'touchAccount');

    const result = await ctx.getSdk();
    expect(result).toHaveProperty('sdk'); // sanity: SDK was returned

    expect(touchSpy).toHaveBeenCalledTimes(1);
    expect(touchSpy).toHaveBeenCalledWith('user-1');
  });
});
