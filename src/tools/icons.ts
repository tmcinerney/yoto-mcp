import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YotoSdk } from '@yotoplay/yoto-sdk';
import { toolError, toolResult } from './shared.js';

export async function handleListIcons(sdk: YotoSdk): Promise<CallToolResult> {
  try {
    const icons = await sdk.icons.getDisplayIcons();
    return toolResult(icons);
  } catch (err) {
    return toolError(`Failed to list icons: ${(err as Error).message}`);
  }
}
