import type { UserCard, YotoJson } from '@yotoplay/yoto-sdk';
import { describe, expect, it, vi } from 'vitest';
import { handleGetCard, handleListCards } from '../../src/tools/library.js';
import { createMockSdk } from './helpers.js';

const MOCK_CARDS: UserCard[] = [
  {
    cardId: 'card-1',
    title: 'Bedtime Stories',
    cover: { imageL: 'https://example.com/img-l.jpg' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    cardId: 'card-2',
    title: 'Kids Songs',
    createdAt: '2026-02-01T00:00:00Z',
  },
];

const MOCK_CARD_DETAIL: YotoJson = {
  content: {
    editKey: 'abc123',
    chapters: [
      {
        key: 'ch1',
        title: 'Chapter 1',
        tracks: [{ key: 't1', trackUrl: 'yoto:#media-id-1', title: 'Track 1', duration: 180 }],
      },
    ],
  },
  metadata: {
    cardId: 'card-1',
    title: 'Bedtime Stories',
    author: 'Trav',
    category: 'stories',
  },
};

describe('handleListCards', () => {
  it('returns formatted card list', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.getMyCards).mockResolvedValue(MOCK_CARDS);

    const result = await handleListCards(sdk);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[0].cardId).toBe('card-1');
    expect(data[0].title).toBe('Bedtime Stories');
    expect(data[1].cardId).toBe('card-2');
  });

  it('returns empty array when no cards exist', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.getMyCards).mockResolvedValue([]);

    const result = await handleListCards(sdk);

    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual([]);
  });

  it('returns error when SDK throws', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.getMyCards).mockRejectedValue(new Error('API error'));

    const result = await handleListCards(sdk);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('API error');
  });
});

describe('handleGetCard', () => {
  it('returns card details', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.getCard).mockResolvedValue(MOCK_CARD_DETAIL);

    const result = await handleGetCard(sdk, 'card-1');

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata.cardId).toBe('card-1');
    expect(data.content.chapters).toHaveLength(1);
  });

  it('returns error when SDK throws', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.getCard).mockRejectedValue(new Error('Card not found'));

    const result = await handleGetCard(sdk, 'nonexistent');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Card not found');
  });
});
