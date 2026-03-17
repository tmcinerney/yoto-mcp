import { describe, expect, it, vi } from 'vitest';
import {
  handleCreateCard,
  handleDeleteCard,
  handleUpdateCard,
  type YotoCard,
} from '../../src/tools/content.js';
import { createMockSdk } from './helpers.js';

const MOCK_CARD: YotoCard = {
  content: {
    editKey: 'edit-1',
    chapters: [],
  },
  metadata: {
    cardId: 'card-new',
    title: 'New Card',
    author: 'Trav',
    category: 'music',
  },
};

describe('handleCreateCard', () => {
  it('creates a card with title at top level', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.updateCard).mockResolvedValue(MOCK_CARD);

    const result = await handleCreateCard(sdk, { title: 'New Card' });

    expect(result.isError).toBeUndefined();
    const cardArg = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    expect(cardArg).toHaveProperty('title', 'New Card');
    expect(cardArg.metadata).not.toHaveProperty('title');
  });

  it('creates a card with all optional fields in metadata', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.updateCard).mockResolvedValue(MOCK_CARD);

    const result = await handleCreateCard(sdk, {
      title: 'Full Card',
      author: 'Trav',
      category: 'stories',
      description: 'A test card',
    });

    expect(result.isError).toBeUndefined();
    const cardArg = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    expect(cardArg).toHaveProperty('title', 'Full Card');
    expect(cardArg.metadata).toEqual(
      expect.objectContaining({
        author: 'Trav',
        category: 'stories',
        description: 'A test card',
      }),
    );
    expect(cardArg.metadata).not.toHaveProperty('title');
  });

  it('returns error when SDK throws', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.updateCard).mockRejectedValue(new Error('Create failed'));

    const result = await handleCreateCard(sdk, { title: 'Fails' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Create failed');
  });
});

describe('handleUpdateCard', () => {
  it('updates a card and injects cardId into payload', async () => {
    const card: YotoCard = {
      content: { editKey: 'edit-1', chapters: [] },
      metadata: { title: 'Updated' },
    };
    const sdk = createMockSdk();
    vi.mocked(sdk.content.getCard).mockResolvedValue(card);
    vi.mocked(sdk.content.updateCard).mockResolvedValue(card);

    const result = await handleUpdateCard(sdk, { cardId: 'card-1', card });

    expect(result.isError).toBeUndefined();
    const cardArg = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    expect(cardArg).toHaveProperty('cardId', 'card-1');
  });

  it('returns error when getCard throws', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.getCard).mockRejectedValue(new Error('Update failed'));

    const result = await handleUpdateCard(sdk, { cardId: 'card-1', card: MOCK_CARD });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Update failed');
  });
});

describe('handleCreateCard — title placement', () => {
  it('places title at the top level of the card, not in metadata', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.updateCard).mockResolvedValue(MOCK_CARD);

    await handleCreateCard(sdk, { title: 'Top Level Title' });

    const cardArg = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    expect(cardArg).toHaveProperty('title', 'Top Level Title');
  });

  it('does NOT put title inside metadata', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.updateCard).mockResolvedValue(MOCK_CARD);

    await handleCreateCard(sdk, { title: 'Top Level Title' });

    const cardArg = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    expect(cardArg.metadata).not.toHaveProperty('title');
  });

  it('keeps author, category, and description in metadata', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.updateCard).mockResolvedValue(MOCK_CARD);

    await handleCreateCard(sdk, {
      title: 'Top Level Title',
      author: 'Trav',
      category: 'stories',
      description: 'A test card',
    });

    const cardArg = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    expect(cardArg.metadata).toEqual(
      expect.objectContaining({
        author: 'Trav',
        category: 'stories',
        description: 'A test card',
      }),
    );
    expect(cardArg.metadata).not.toHaveProperty('title');
  });
});

describe('handleCreateCard — device playback defaults', () => {
  // These fields are required by the Yoto device firmware for playback.
  // Discovered by comparing cards from the official MYO portal vs our API.
  it('sets activity, restricted, version, and config defaults on new cards', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.updateCard).mockResolvedValue(MOCK_CARD);

    await handleCreateCard(sdk, { title: 'Test' });

    const cardArg = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    expect(cardArg.content).toHaveProperty('activity', 'yoto_Player');
    expect(cardArg.content).toHaveProperty('restricted', true);
    expect(cardArg.content).toHaveProperty('version', '1');
    expect(cardArg.content?.config).toEqual(
      expect.objectContaining({ resumeTimeout: 2592000, onlineOnly: false }),
    );
  });
});

describe('handleUpdateCard — device playback defaults', () => {
  it('applies format: opus and channels: stereo to tracks missing them', async () => {
    const sdk = createMockSdk();
    const existing: YotoCard = {
      content: {
        chapters: [
          {
            key: '00',
            title: 'Ch 1',
            tracks: [{ key: '01', title: 'Track 1', trackUrl: 'yoto:#abc', type: 'audio' }],
          },
        ],
      },
      metadata: {},
    };
    vi.mocked(sdk.content.getCard).mockResolvedValue(existing);
    vi.mocked(sdk.content.updateCard).mockResolvedValue(existing);

    await handleUpdateCard(sdk, { cardId: 'card-1', card: existing });

    const sent = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    const track = (sent.content?.chapters as Array<{ tracks: Array<Record<string, unknown>> }>)[0]
      .tracks[0];
    expect(track.format).toBe('opus');
    expect(track.channels).toBe('stereo');
  });

  it('normalizes chapter keys to zero-based two-digit format', async () => {
    const sdk = createMockSdk();
    const existing: YotoCard = {
      content: {
        chapters: [
          { key: '001', title: 'Ch 1', tracks: [] },
          { key: '002', title: 'Ch 2', tracks: [] },
        ],
      },
      metadata: {},
    };
    vi.mocked(sdk.content.getCard).mockResolvedValue(existing);
    vi.mocked(sdk.content.updateCard).mockResolvedValue(existing);

    await handleUpdateCard(sdk, { cardId: 'card-1', card: existing });

    const sent = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    const chapters = sent.content?.chapters as Array<{ key: string }>;
    expect(chapters[0].key).toBe('00');
    expect(chapters[1].key).toBe('01');
  });

  it('sets card-level activity and config defaults on update', async () => {
    const sdk = createMockSdk();
    const existing: YotoCard = {
      content: { chapters: [] },
      metadata: {},
    };
    vi.mocked(sdk.content.getCard).mockResolvedValue(existing);
    vi.mocked(sdk.content.updateCard).mockResolvedValue(existing);

    await handleUpdateCard(sdk, { cardId: 'card-1', card: existing });

    const sent = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    expect(sent.content).toHaveProperty('activity', 'yoto_Player');
    expect(sent.content).toHaveProperty('restricted', true);
    expect(sent.content).toHaveProperty('version', '1');
    expect(sent.content?.config).toEqual(
      expect.objectContaining({ onlineOnly: false }),
    );
  });

  it('does not overwrite existing format if already set', async () => {
    const sdk = createMockSdk();
    const existing: YotoCard = {
      content: {
        chapters: [
          {
            key: '00',
            title: 'Ch 1',
            tracks: [{ key: '01', title: 'Track', trackUrl: 'yoto:#abc', type: 'audio', format: 'mp3' }],
          },
        ],
      },
      metadata: {},
    };
    vi.mocked(sdk.content.getCard).mockResolvedValue(existing);
    vi.mocked(sdk.content.updateCard).mockResolvedValue(existing);

    await handleUpdateCard(sdk, { cardId: 'card-1', card: existing });

    const sent = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    const track = (sent.content?.chapters as Array<{ tracks: Array<Record<string, unknown>> }>)[0]
      .tracks[0];
    expect(track.format).toBe('mp3');
  });
});

describe('handleUpdateCard — cardId injection', () => {
  it('injects cardId into the card object before calling SDK', async () => {
    const sdk = createMockSdk();
    const card: YotoCard = {
      content: { editKey: 'edit-1', chapters: [] },
      metadata: { title: 'Test' },
    };
    vi.mocked(sdk.content.getCard).mockResolvedValue(card);
    vi.mocked(sdk.content.updateCard).mockResolvedValue({ ...card, cardId: 'card-42' } as YotoCard);

    await handleUpdateCard(sdk, { cardId: 'card-42', card });

    const cardArg = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    expect(cardArg).toHaveProperty('cardId', 'card-42');
  });

  it('passes cardId matching args.cardId to sdk.content.updateCard', async () => {
    const sdk = createMockSdk();
    const card: YotoCard = {
      content: { editKey: 'edit-1', chapters: [] },
      metadata: { title: 'Test' },
    };
    vi.mocked(sdk.content.getCard).mockResolvedValue(card);
    vi.mocked(sdk.content.updateCard).mockResolvedValue({ ...card, cardId: 'xyz-789' } as YotoCard);

    await handleUpdateCard(sdk, { cardId: 'xyz-789', card });

    expect(sdk.content.updateCard).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'xyz-789' }),
    );
  });
});

describe('handleUpdateCard — read-merge-write', () => {
  it('merges partial update onto existing card data', async () => {
    const sdk = createMockSdk();

    // Existing card returned by getCard
    const existingCard: YotoCard = {
      content: {
        editKey: 'edit-1',
        chapters: [
          { key: 'ch-1', title: 'Chapter 1', tracks: [] },
          { key: 'ch-2', title: 'Chapter 2', tracks: [] },
        ],
      },
      metadata: {
        title: 'Original Title',
        author: 'Original Author',
        category: 'stories',
      },
    };

    vi.mocked(sdk.content.getCard).mockResolvedValue(existingCard);
    vi.mocked(sdk.content.updateCard).mockResolvedValue(existingCard);

    // Partial update: only new chapters, no title/metadata
    const partialCard = {
      content: {
        editKey: 'edit-1',
        chapters: [
          { key: 'ch-1', title: 'Chapter 1', tracks: [] },
          { key: 'ch-2', title: 'Chapter 2', tracks: [] },
          { key: 'ch-3', title: 'Chapter 3', tracks: [] },
        ],
      },
    } as unknown as YotoCard;

    const result = await handleUpdateCard(sdk, { cardId: 'card-1', card: partialCard });

    expect(result.isError).toBeUndefined();
    // Should have fetched existing card first
    expect(sdk.content.getCard).toHaveBeenCalledWith('card-1');
    // Merged result should preserve existing title/metadata and use new chapters
    const cardSentToUpdate = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    expect(cardSentToUpdate).toHaveProperty('cardId', 'card-1');
    expect(cardSentToUpdate.metadata?.title).toBe('Original Title');
    expect(cardSentToUpdate.metadata?.author).toBe('Original Author');
    expect(cardSentToUpdate.content?.chapters).toHaveLength(3);
  });

  it('preserves existing fields not included in update', async () => {
    const sdk = createMockSdk();

    const existingCard: YotoCard = {
      content: {
        editKey: 'edit-1',
        chapters: [{ key: 'ch-1', title: 'Chapter 1', tracks: [] }],
      },
      metadata: {
        title: 'My Card',
        author: 'Trav',
        category: 'music',
        description: 'A great card',
      },
    };

    vi.mocked(sdk.content.getCard).mockResolvedValue(existingCard);
    vi.mocked(sdk.content.updateCard).mockResolvedValue(existingCard);

    // Only update content, omit metadata entirely
    const partialCard = {
      content: {
        editKey: 'edit-2',
        chapters: [{ key: 'ch-1', title: 'Chapter 1 Updated', tracks: [] }],
      },
    } as unknown as YotoCard;

    await handleUpdateCard(sdk, { cardId: 'card-42', card: partialCard });

    const cardSentToUpdate = vi.mocked(sdk.content.updateCard).mock.calls[0][0];
    // Original metadata fields should still be present
    expect(cardSentToUpdate.metadata?.title).toBe('My Card');
    expect(cardSentToUpdate.metadata?.author).toBe('Trav');
    expect(cardSentToUpdate.metadata?.category).toBe('music');
    expect(cardSentToUpdate.metadata?.description).toBe('A great card');
    // Content should reflect the update
    expect(cardSentToUpdate.content?.editKey).toBe('edit-2');
  });

  it('returns error when getCard fails', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.getCard).mockRejectedValue(new Error('Card not found'));

    const result = await handleUpdateCard(sdk, { cardId: 'card-missing', card: MOCK_CARD });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Card not found');
  });
});

describe('handleDeleteCard', () => {
  it('deletes a card and returns confirmation', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.deleteCard).mockResolvedValue(undefined);

    const result = await handleDeleteCard(sdk, 'card-1');

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('card-1');
    expect(result.content[0].text).toContain('deleted');
    expect(sdk.content.deleteCard).toHaveBeenCalledWith('card-1');
  });

  it('returns error when SDK throws', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.deleteCard).mockRejectedValue(new Error('Delete failed'));

    const result = await handleDeleteCard(sdk, 'nonexistent');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Delete failed');
  });
});
