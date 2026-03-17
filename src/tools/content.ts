import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YotoSdk } from '@yotoplay/yoto-sdk';
import { classifyApiError, toolError, toolResult } from './shared.js';

// SDK's YotoJson is too narrow ({ content, metadata }). The real API
// has top-level fields like title, cardId, userId. This extended type bridges the gap.
export interface YotoCard {
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}

// Card-level content defaults matching the official MYO portal.
// These are sensible defaults but NOT required for device playback.
// The only playback-critical field is `format: "opus"` on tracks.
const MYO_CARD_DEFAULTS = {
  activity: 'yoto_Player',
  restricted: true,
  version: '1',
} as const;

const MYO_CONFIG_DEFAULTS = {
  resumeTimeout: 2592000, // 30 days — how long device remembers playback position
  onlineOnly: false, // enables offline/device playback
} as const;

// PLAYBACK-CRITICAL: Yoto transcodes all uploads to Opus. The format field
// tells the device firmware which decoder to use. "aac" causes tracks to
// skip on the physical device (the phone app is more forgiving and plays
// either). Confirmed by isolated test: same card, one track "opus" played,
// remaining "aac" tracks skipped.
const TRACK_FORMAT = 'opus';

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

interface Track {
  trackUrl?: string;
  title?: string;
  key?: string;
  type?: string;
  format?: string;
  channels?: string;
  duration?: number;
  fileSize?: number;
  display?: unknown;
  overlayLabel?: string;
  [key: string]: unknown;
}

interface Chapter {
  key?: string;
  title?: string;
  tracks?: Track[];
  display?: unknown;
  overlayLabel?: string;
  duration?: number;
  fileSize?: number;
  [key: string]: unknown;
}

/** Apply device-required defaults to tracks missing them */
function applyTrackDefaults(track: Track, chapterIndex: number): Track {
  return {
    ...track,
    format: track.format ?? TRACK_FORMAT,
    channels: track.channels ?? 'stereo',
    type: track.type ?? 'audio',
    overlayLabel: track.overlayLabel ?? String(chapterIndex + 1),
  };
}

/** Ensure chapter keys are zero-based two-digit (00, 01, 02...) as the
 *  official MYO portal generates. Three-digit keys (001, 002) cause
 *  playback issues on some device firmware versions. */
function applyChapterDefaults(chapter: Chapter, index: number): Chapter {
  const key = String(index).padStart(2, '0');
  const tracks = (chapter.tracks ?? []).map((t: Track) => applyTrackDefaults(t, index));
  return {
    ...chapter,
    key,
    overlayLabel: chapter.overlayLabel ?? String(index + 1),
    tracks,
  };
}

/** Ensure card-level content has the fields the device firmware requires */
function ensureCardDefaults(content: Record<string, unknown>): Record<string, unknown> {
  const config = (content.config ?? {}) as Record<string, unknown>;
  const chapters = ((content.chapters ?? []) as Chapter[]).map(applyChapterDefaults);

  return {
    ...MYO_CARD_DEFAULTS,
    ...content,
    config: { ...MYO_CONFIG_DEFAULTS, ...config },
    chapters,
  };
}

export async function handleCreateCard(
  sdk: YotoSdk,
  args: CreateCardArgs,
): Promise<CallToolResult> {
  try {
    const card: YotoCard = {
      title: args.title,
      content: ensureCardDefaults({ chapters: [] }),
      metadata: {
        ...(args.author && { author: args.author }),
        ...(args.category && { category: args.category }),
        ...(args.description && { description: args.description }),
      },
    };
    const created = await sdk.content.updateCard(card);
    return toolResult(created);
  } catch (err) {
    return toolError(classifyApiError('Failed to create card', err));
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
    const mergedContent = {
      ...(existing.content ?? {}),
      ...(args.card.content ?? {}),
    };

    const merged: YotoCard = {
      ...existing,
      ...args.card,
      content: ensureCardDefaults(mergedContent),
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
    return toolError(classifyApiError(`Failed to update card '${args.cardId}'`, err));
  }
}

export async function handleDeleteCard(sdk: YotoSdk, cardId: string): Promise<CallToolResult> {
  try {
    await sdk.content.deleteCard(cardId);
    return toolResult({ cardId, deleted: true });
  } catch (err) {
    return toolError(classifyApiError(`Failed to delete card '${cardId}'`, err));
  }
}
