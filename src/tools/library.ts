import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YotoSdk } from '@yotoplay/yoto-sdk';
import { toolError, toolResult } from './shared.js';

export async function handleListCards(sdk: YotoSdk): Promise<CallToolResult> {
  try {
    const cards = await sdk.content.getMyCards();
    return toolResult(cards);
  } catch (err) {
    return toolError(`Failed to list cards: ${(err as Error).message}`);
  }
}

export async function handleGetCard(sdk: YotoSdk, cardId: string): Promise<CallToolResult> {
  try {
    const card = await sdk.content.getCard(cardId);
    return toolResult(card);
  } catch (err) {
    return toolError(`Failed to get card '${cardId}': ${(err as Error).message}`);
  }
}
