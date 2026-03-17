import type { DisplayIcon } from '@yotoplay/yoto-sdk';
import { describe, expect, it, vi } from 'vitest';
import { handleListIcons, handleSearchIcons } from '../../src/tools/icons.js';
import { createMockSdk } from './helpers.js';

const MOCK_ICONS: DisplayIcon[] = [
  {
    displayIconId: 'icon-1',
    mediaId: 'media-1',
    userId: 'user-1',
    title: 'Star',
    url: 'https://example.com/star.png',
    public: true,
    publicTags: ['default', 'sky'],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    displayIconId: 'icon-2',
    mediaId: 'media-2',
    userId: 'user-1',
    title: 'Moon',
    url: 'https://example.com/moon.png',
    public: true,
    publicTags: ['night', 'sky'],
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    displayIconId: 'icon-3',
    mediaId: 'media-3',
    userId: 'user-1',
    title: 'Music notes',
    url: 'https://example.com/music.png',
    public: true,
    publicTags: ['music', 'note'],
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    displayIconId: 'icon-4',
    mediaId: 'media-4',
    userId: 'user-1',
    title: 'Blue truck',
    url: 'https://example.com/truck.png',
    public: true,
    publicTags: ['vehicle', 'truck', 'blue'],
    createdAt: '2026-03-02T00:00:00Z',
  },
];

describe('handleListIcons', () => {
  it('returns formatted icon list', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.icons.getDisplayIcons).mockResolvedValue(MOCK_ICONS);

    const result = await handleListIcons(sdk);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(4);
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

describe('handleSearchIcons', () => {
  it('matches by title', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.icons.getDisplayIcons).mockResolvedValue(MOCK_ICONS);

    const result = await handleSearchIcons(sdk, { query: 'moon' });
    const data = JSON.parse(result.content[0].text);

    expect(data.total).toBe(1);
    expect(data.results[0].title).toBe('Moon');
    expect(data.results[0].ref).toBe('yoto:#media-2');
  });

  it('matches by tag', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.icons.getDisplayIcons).mockResolvedValue(MOCK_ICONS);

    const result = await handleSearchIcons(sdk, { query: 'vehicle' });
    const data = JSON.parse(result.content[0].text);

    expect(data.total).toBe(1);
    expect(data.results[0].title).toBe('Blue truck');
  });

  it('matches multiple terms (AND logic)', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.icons.getDisplayIcons).mockResolvedValue(MOCK_ICONS);

    // "sky" matches Star and Moon; "night" narrows to Moon only
    const result = await handleSearchIcons(sdk, { query: 'sky night' });
    const data = JSON.parse(result.content[0].text);

    expect(data.total).toBe(1);
    expect(data.results[0].title).toBe('Moon');
  });

  it('is case-insensitive', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.icons.getDisplayIcons).mockResolvedValue(MOCK_ICONS);

    const result = await handleSearchIcons(sdk, { query: 'MUSIC' });
    const data = JSON.parse(result.content[0].text);

    expect(data.total).toBe(1);
    expect(data.results[0].title).toBe('Music notes');
  });

  it('respects limit parameter', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.icons.getDisplayIcons).mockResolvedValue(MOCK_ICONS);

    // "sky" matches Star and Moon
    const result = await handleSearchIcons(sdk, { query: 'sky', limit: 1 });
    const data = JSON.parse(result.content[0].text);

    expect(data.total).toBe(2);
    expect(data.results).toHaveLength(1);
  });

  it('returns empty results for no match', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.icons.getDisplayIcons).mockResolvedValue(MOCK_ICONS);

    const result = await handleSearchIcons(sdk, { query: 'dinosaur' });
    const data = JSON.parse(result.content[0].text);

    expect(data.total).toBe(0);
    expect(data.results).toHaveLength(0);
  });

  it('includes mediaId, ref, title, tags, and url in results', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.icons.getDisplayIcons).mockResolvedValue(MOCK_ICONS);

    const result = await handleSearchIcons(sdk, { query: 'truck' });
    const data = JSON.parse(result.content[0].text);
    const icon = data.results[0];

    expect(icon).toEqual({
      mediaId: 'media-4',
      ref: 'yoto:#media-4',
      title: 'Blue truck',
      tags: ['vehicle', 'truck', 'blue'],
      url: 'https://example.com/truck.png',
    });
  });

  it('returns error when SDK throws', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.icons.getDisplayIcons).mockRejectedValue(new Error('API down'));

    const result = await handleSearchIcons(sdk, { query: 'star' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('API down');
  });
});
