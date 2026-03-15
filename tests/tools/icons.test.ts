import type { DisplayIcon } from '@yotoplay/yoto-sdk';
import { describe, expect, it, vi } from 'vitest';
import { handleListIcons } from '../../src/tools/icons.js';
import { createMockSdk } from './helpers.js';

const MOCK_ICONS: DisplayIcon[] = [
  {
    displayIconId: 'icon-1',
    mediaId: 'media-1',
    userId: 'user-1',
    title: 'Star',
    url: 'https://example.com/star.png',
    public: true,
    publicTags: ['default'],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    displayIconId: 'icon-2',
    mediaId: 'media-2',
    userId: 'user-1',
    title: 'Moon',
    url: 'https://example.com/moon.png',
    public: true,
    publicTags: ['night'],
    createdAt: '2026-02-01T00:00:00Z',
  },
];

describe('handleListIcons', () => {
  it('returns formatted icon list', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.icons.getDisplayIcons).mockResolvedValue(MOCK_ICONS);

    const result = await handleListIcons(sdk);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[0].displayIconId).toBe('icon-1');
    expect(data[0].title).toBe('Star');
  });

  it('returns error when SDK throws', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.icons.getDisplayIcons).mockRejectedValue(new Error('Icons unavailable'));

    const result = await handleListIcons(sdk);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Icons unavailable');
  });
});
