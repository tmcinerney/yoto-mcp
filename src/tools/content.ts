import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YotoJson, YotoSdk } from '@yotoplay/yoto-sdk';
import { toolError, toolResult } from './shared.js';

interface CreateCardArgs {
  title: string;
  author?: string;
  category?: string;
  description?: string;
}

interface UpdateCardArgs {
  cardId: string;
  card: YotoJson;
}

export async function handleCreateCard(
  sdk: YotoSdk,
  args: CreateCardArgs,
): Promise<CallToolResult> {
  try {
    // AIDEV-NOTE: title must be top-level for Yoto API. Cast past narrow SDK YotoJson type.
    const card = {
      title: args.title,
      content: { chapters: [] },
      metadata: {
        ...(args.author && { author: args.author }),
        ...(args.category && { category: args.category }),
        ...(args.description && { description: args.description }),
      },
    } as unknown as YotoJson;
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
    // Fetch existing card to merge onto — prevents data loss from partial updates
    const existing = (await sdk.content.getCard(args.cardId)) as unknown as Record<string, unknown>;
    const incoming = args.card as unknown as Record<string, unknown>;

    // Shallow merge: incoming fields override existing, missing fields preserved
    const merged = {
      ...existing,
      ...incoming,
      content: {
        ...((existing.content as Record<string, unknown>) ?? {}),
        ...((incoming.content as Record<string, unknown>) ?? {}),
      },
      metadata: {
        ...((existing.metadata as Record<string, unknown>) ?? {}),
        ...((incoming.metadata as Record<string, unknown>) ?? {}),
      },
      // AIDEV-NOTE: cardId must be in payload for API to update (not create)
      cardId: args.cardId,
    } as unknown as YotoJson;

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
