import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YotoSdk } from '@yotoplay/yoto-sdk';
import { classifyApiError, toolError, toolResult } from './shared.js';

export async function handleListCards(sdk: YotoSdk): Promise<CallToolResult> {
  try {
    const cards = await sdk.content.getMyCards();
    return toolResult(cards);
  } catch (err) {
    return toolError(classifyApiError('Failed to list cards', err));
  }
}

export async function handleGetCard(sdk: YotoSdk, cardId: string): Promise<CallToolResult> {
  try {
    const card = await sdk.content.getCard(cardId);
    return toolResult(card);
  } catch (err) {
    return toolError(classifyApiError(`Failed to get card '${cardId}'`, err));
  }
}
