import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YotoSdk } from '@yotoplay/yoto-sdk';
import { toolError, toolResult } from './shared.js';

// SDK's YotoJson is too narrow ({ content, metadata }). The real API
// has top-level fields like title, cardId, userId. This extended type bridges the gap.
export interface YotoCard {
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}

interface CreateCardArgs {
  title: string;
  author?: string;
  category?: string;
  description?: string;
}

interface UpdateCardArgs {
  cardId: string;
  card: YotoCard;
}

export async function handleCreateCard(
  sdk: YotoSdk,
  args: CreateCardArgs,
): Promise<CallToolResult> {
  try {
    // Title must be top-level for Yoto API
    const card: YotoCard = {
      title: args.title,
      content: { chapters: [] },
      metadata: {
        ...(args.author && { author: args.author }),
        ...(args.category && { category: args.category }),
        ...(args.description && { description: args.description }),
      },
    };
    const created = await sdk.content.updateCard(card);
    return toolResult(created);
  } catch (err) {
    return toolError(`Failed to create card: ${(err as Error).message}`);
  }
}

export async function handleUpdateCard(
  sdk: YotoSdk,
  args: UpdateCardArgs,
): Promise<CallToolResult> {
  try {
    // Reject conflicting cardId in payload to prevent cross-card updates
    if (args.card.cardId && args.card.cardId !== args.cardId) {
      return toolError(
        `cardId in card JSON ('${args.card.cardId}') does not match cardId parameter ('${args.cardId}')`,
      );
    }

    // Fetch existing card to merge onto — prevents data loss from partial updates
    const existing = (await sdk.content.getCard(args.cardId)) as YotoCard;

    // Shallow merge: incoming fields override existing, missing fields preserved
    const merged: YotoCard = {
      ...existing,
      ...args.card,
      content: {
        ...(existing.content ?? {}),
        ...(args.card.content ?? {}),
      },
      metadata: {
        ...(existing.metadata ?? {}),
        ...(args.card.metadata ?? {}),
      },
      // cardId must be in payload for API to update (not create)
      cardId: args.cardId,
    };

    const updated = await sdk.content.updateCard(merged);
    return toolResult(updated);
  } catch (err) {
    return toolError(`Failed to update card '${args.cardId}': ${(err as Error).message}`);
  }
}

export async function handleDeleteCard(sdk: YotoSdk, cardId: string): Promise<CallToolResult> {
  try {
    await sdk.content.deleteCard(cardId);
    return toolResult({ cardId, deleted: true });
  } catch (err) {
    return toolError(`Failed to delete card '${cardId}': ${(err as Error).message}`);
  }
}
