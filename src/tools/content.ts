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
    const card: YotoJson = {
      content: { chapters: [] },
      metadata: {
        title: args.title,
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
    const updated = await sdk.content.updateCard(args.card);
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
