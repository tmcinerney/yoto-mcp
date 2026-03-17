import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YotoSdk } from '@yotoplay/yoto-sdk';
import { classifyApiError, toolError, toolResult } from './shared.js';

interface Icon {
  mediaId: string;
  title?: string;
  publicTags?: string[];
  url?: string;
  [key: string]: unknown;
}

export async function handleListIcons(sdk: YotoSdk): Promise<CallToolResult> {
  try {
    const icons = await sdk.icons.getDisplayIcons();
    return toolResult(icons);
  } catch (err) {
    return toolError(classifyApiError('Failed to list icons', err));
  }
}

interface SearchIconsArgs {
  query: string;
  limit?: number;
}

export async function handleSearchIcons(
  sdk: YotoSdk,
  args: SearchIconsArgs,
): Promise<CallToolResult> {
  try {
    const icons = (await sdk.icons.getDisplayIcons()) as unknown as Icon[];
    const terms = args.query.toLowerCase().split(/\s+/).filter(Boolean);
    const limit = args.limit ?? 20;

    const matches = icons.filter((icon) => {
      const searchable = [icon.title ?? '', ...(icon.publicTags ?? [])].join(' ').toLowerCase();
      return terms.every((term) => searchable.includes(term));
    });

    const results = matches.slice(0, limit).map((icon) => ({
      mediaId: icon.mediaId,
      ref: `yoto:#${icon.mediaId}`,
      title: icon.title,
      tags: icon.publicTags,
      url: icon.url,
    }));

    return toolResult({ query: args.query, total: matches.length, results });
  } catch (err) {
    return toolError(classifyApiError('Failed to search icons', err));
  }
}
