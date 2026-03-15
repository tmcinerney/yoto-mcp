import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolvePath, TokenStore } from '../../src/auth/token-store.js';
import type { AccountRecord } from '../../src/auth/types.js';

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

describe('resolvePath', () => {
  it('expands ~ to home directory', () => {
    const result = resolvePath('~/foo/bar');
    expect(result).not.toContain('~');
    expect(result).toMatch(/foo\/bar$/);
  });

  it('leaves absolute paths unchanged', () => {
    expect(resolvePath('/custom/path')).toBe('/custom/path');
  });
});

describe('TokenStore', () => {
  let configDir: string;
  let store: TokenStore;

  beforeEach(async () => {
    configDir = join(
      tmpdir(),
      `yoto-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    store = new TokenStore(configDir);
  });

  afterEach(async () => {
    await rm(configDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('creates accounts.json on first load', async () => {
      await store.load();

      const raw = await readFile(join(configDir, 'accounts.json'), 'utf-8');
      const data = JSON.parse(raw);
      expect(data).toEqual({ defaultAccount: null, accounts: {} });
    });

    it('loads existing accounts from disk', async () => {
      // Pre-seed the store
      await store.load();
      await store.setAccount(makeAccount());

      // New store instance reads from disk
      const store2 = new TokenStore(configDir);
      await store2.load();

      expect(store2.getAccount('user-1')).toEqual(expect.objectContaining({ userId: 'user-1' }));
    });
  });

  describe('setAccount', () => {
    it('stores an account and auto-sets default for first account', async () => {
      await store.load();
      await store.setAccount(makeAccount());

      expect(store.getDefaultAccountId()).toBe('user-1');
      expect(store.getAccount('user-1')?.email).toBe('trav@example.com');
    });

    it('does not change default when adding a second account', async () => {
      await store.load();
      await store.setAccount(makeAccount());
      await store.setAccount(makeAccount({ userId: 'user-2', email: 'kat@example.com' }));

      expect(store.getDefaultAccountId()).toBe('user-1');
      expect(Object.keys(store.getAccounts())).toHaveLength(2);
    });
  });

  describe('removeAccount', () => {
    it('removes an account and clears default if it was the removed one', async () => {
      await store.load();
      await store.setAccount(makeAccount());
      await store.setAccount(makeAccount({ userId: 'user-2' }));

      await store.removeAccount('user-1');

      expect(store.getAccount('user-1')).toBeUndefined();
      expect(store.getDefaultAccountId()).toBe('user-2');
    });

    it('sets default to null when last account is removed', async () => {
      await store.load();
      await store.setAccount(makeAccount());
      await store.removeAccount('user-1');

      expect(store.getDefaultAccountId()).toBeNull();
    });
  });

  describe('setDefaultAccount', () => {
    it('switches the default account', async () => {
      await store.load();
      await store.setAccount(makeAccount());
      await store.setAccount(makeAccount({ userId: 'user-2' }));

      await store.setDefaultAccount('user-2');
      expect(store.getDefaultAccountId()).toBe('user-2');
    });

    it('throws when account does not exist', async () => {
      await store.load();
      await expect(store.setDefaultAccount('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('getAccount', () => {
    it('returns default account when no ID provided', async () => {
      await store.load();
      await store.setAccount(makeAccount());

      expect(store.getAccount()?.userId).toBe('user-1');
    });

    it('returns undefined when no accounts exist', async () => {
      await store.load();
      expect(store.getAccount()).toBeUndefined();
    });
  });

  describe('getExpiringAccounts', () => {
    it('finds accounts expiring within the window', async () => {
      await store.load();

      // Expires in 30 minutes
      await store.setAccount(
        makeAccount({ expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }),
      );

      // Expires in 2 hours
      await store.setAccount(
        makeAccount({
          userId: 'user-2',
          expiresAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
        }),
      );

      const expiring = store.getExpiringAccounts(60 * 60_000); // 1hr window
      expect(expiring).toHaveLength(1);
      expect(expiring[0].userId).toBe('user-1');
    });
  });

  describe('updateTokens', () => {
    it('updates tokens for an existing account', async () => {
      await store.load();
      await store.setAccount(makeAccount());

      const newExpiry = new Date(Date.now() + 86_400_000).toISOString();
      await store.updateTokens('user-1', 'new-access', 'new-refresh', newExpiry);

      const account = store.getAccount('user-1');
      expect(account?.accessToken).toBe('new-access');
      expect(account?.refreshToken).toBe('new-refresh');
      expect(account?.expiresAt).toBe(newExpiry);
    });

    it('throws when account does not exist', async () => {
      await store.load();
      await expect(
        store.updateTokens('nonexistent', 'a', 'b', new Date().toISOString()),
      ).rejects.toThrow('not found');
    });
  });

  describe('atomic writes', () => {
    it('persists data that survives a new instance', async () => {
      await store.load();
      await store.setAccount(makeAccount());
      await store.setAccount(makeAccount({ userId: 'user-2', displayName: 'Kat' }));
      await store.setDefaultAccount('user-2');

      // Fresh instance
      const store2 = new TokenStore(configDir);
      await store2.load();

      expect(store2.getDefaultAccountId()).toBe('user-2');
      expect(Object.keys(store2.getAccounts())).toHaveLength(2);
      expect(store2.getAccount('user-2')?.displayName).toBe('Kat');
    });
  });
});
