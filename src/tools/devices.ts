import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YotoSdk } from '@yotoplay/yoto-sdk';
import { toolError, toolResult } from './shared.js';

export async function handleListDevices(sdk: YotoSdk): Promise<CallToolResult> {
  try {
    const devices = await sdk.devices.getMyDevices();
    return toolResult(devices);
  } catch (err) {
    return toolError(`Failed to list devices: ${(err as Error).message}`);
  }
}
