import type { YotoJson } from '@yotoplay/yoto-sdk';
import { describe, expect, it, vi } from 'vitest';
import { handleCreateCard, handleDeleteCard, handleUpdateCard } from '../../src/tools/content.js';
import { createMockSdk } from './helpers.js';

const MOCK_CARD: YotoJson = {
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
  it('creates a card with title only', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.updateCard).mockResolvedValue(MOCK_CARD);

    const result = await handleCreateCard(sdk, { title: 'New Card' });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata.title).toBe('New Card');
    expect(sdk.content.updateCard).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ title: 'New Card' }),
      }),
    );
  });

  it('creates a card with all optional fields', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.updateCard).mockResolvedValue(MOCK_CARD);

    const result = await handleCreateCard(sdk, {
      title: 'Full Card',
      author: 'Trav',
      category: 'stories',
      description: 'A test card',
    });

    expect(result.isError).toBeUndefined();
    expect(sdk.content.updateCard).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          title: 'Full Card',
          author: 'Trav',
          category: 'stories',
          description: 'A test card',
        }),
      }),
    );
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
  it('updates a card with the given YotoJson', async () => {
    const updated = { ...MOCK_CARD, metadata: { ...MOCK_CARD.metadata, title: 'Updated' } };
    const sdk = createMockSdk();
    vi.mocked(sdk.content.updateCard).mockResolvedValue(updated);

    const result = await handleUpdateCard(sdk, { cardId: 'card-1', card: updated });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata.title).toBe('Updated');
    expect(sdk.content.updateCard).toHaveBeenCalledWith(updated);
  });

  it('returns error when SDK throws', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.content.updateCard).mockRejectedValue(new Error('Update failed'));

    const result = await handleUpdateCard(sdk, { cardId: 'card-1', card: MOCK_CARD });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Update failed');
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
