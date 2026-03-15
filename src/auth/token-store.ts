import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { AccountRecord, AccountsFile } from './types.js';

/** Resolve ~ to home directory at the start of a path */
export function resolvePath(configDir: string): string {
  if (configDir.startsWith('~/')) {
    return join(homedir(), configDir.slice(2));
  }
  return configDir;
}

export class TokenStore {
  private readonly filePath: string;
  private data: AccountsFile;

  constructor(configDir: string) {
    this.filePath = join(resolvePath(configDir), 'accounts.json');
    this.data = { defaultAccount: null, accounts: {} };
  }

  /** Load accounts from disk. Creates the file if it doesn't exist. */
  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(raw) as AccountsFile;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // First run — create empty config
        await this.save();
        return;
      }
      throw err;
    }
  }

  /**
   * Persist accounts to disk via atomic write (temp file + rename).
   * POSIX rename is atomic, so a crash mid-write won't corrupt the file.
   */
  private async save(): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });

    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
    await rename(tmpPath, this.filePath);
  }

  /** Get all stored accounts */
  getAccounts(): Record<string, AccountRecord> {
    return { ...this.data.accounts };
  }

  /** Get the default account ID, or null if none set */
  getDefaultAccountId(): string | null {
    return this.data.defaultAccount;
  }

  /** Get a specific account, or the default if no ID provided */
  getAccount(accountId?: string): AccountRecord | undefined {
    const id = accountId ?? this.data.defaultAccount;
    if (!id) return undefined;
    return this.data.accounts[id];
  }

  /** Store or update an account record and persist to disk */
  async setAccount(account: AccountRecord): Promise<void> {
    this.data.accounts[account.userId] = account;

    // Auto-set default if this is the first account
    if (!this.data.defaultAccount) {
      this.data.defaultAccount = account.userId;
    }

    await this.save();
  }

  /** Remove an account. Clears default if it was the removed account. */
  async removeAccount(accountId: string): Promise<void> {
    delete this.data.accounts[accountId];

    if (this.data.defaultAccount === accountId) {
      const remaining = Object.keys(this.data.accounts);
      this.data.defaultAccount = remaining[0] ?? null;
    }

    await this.save();
  }

  /** Switch the default account */
  async setDefaultAccount(accountId: string): Promise<void> {
    if (!this.data.accounts[accountId]) {
      throw new Error(`Account ${accountId} not found`);
    }
    this.data.defaultAccount = accountId;
    await this.save();
  }

  /** Update the lastUsed timestamp for an account */
  async touchAccount(accountId: string): Promise<void> {
    const account = this.data.accounts[accountId];
    if (account) {
      account.lastUsed = new Date().toISOString();
      await this.save();
    }
  }

  /**
   * Find accounts whose access tokens expire within the given window.
   * Used by the periodic refresh to find tokens needing proactive renewal.
   */
  getExpiringAccounts(withinMs: number): AccountRecord[] {
    const cutoff = Date.now() + withinMs;
    return Object.values(this.data.accounts).filter(
      (account) => new Date(account.expiresAt).getTime() < cutoff,
    );
  }

  /** Update tokens for an account after a refresh */
  async updateTokens(
    accountId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: string,
  ): Promise<void> {
    const account = this.data.accounts[accountId];
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }
    account.accessToken = accessToken;
    account.refreshToken = refreshToken;
    account.expiresAt = expiresAt;
    await this.save();
  }
}
