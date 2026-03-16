import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YotoSdk } from '@yotoplay/yoto-sdk';
import { toolError, toolResult } from './shared.js';

interface UploadAudioArgs {
  filePath: string;
  filename?: string;
}

const TRANSCODE_POLL_INTERVAL_MS = 10_000;
const TRANSCODE_MAX_WAIT_MS = 15 * 60_000;

interface TranscodeResult {
  mediaUrl: string;
  status: string;
  duration?: number;
  fileSize?: number;
}

async function pollTranscode(sdk: YotoSdk, uploadId: string): Promise<TranscodeResult> {
  const deadline = Date.now() + TRANSCODE_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const transcode = await sdk.media.getTranscodedUpload(uploadId);
    const raw = transcode as Record<string, unknown>;
    const progress = raw.progress as Record<string, unknown> | undefined;

    // Check if transcode is complete — the API uses progress.phase, not a url field
    if (progress?.phase === 'complete' || transcode.url) {
      const transcodedSha256 = raw.transcodedSha256 as string | undefined;
      const mediaUrl = transcode.url ?? (transcodedSha256 ? `yoto:#${transcodedSha256}` : '');
      const info = raw.transcodedInfo as Record<string, unknown> | undefined;

      return {
        mediaUrl,
        status: 'completed',
        duration: info?.duration as number | undefined,
        fileSize: info?.fileSize as number | undefined,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, TRANSCODE_POLL_INTERVAL_MS));
  }

  throw new Error(`Transcode did not complete within ${TRANSCODE_MAX_WAIT_MS / 60_000} minutes`);
}

export async function handleUploadAudio(
  sdk: YotoSdk,
  args: UploadAudioArgs,
): Promise<CallToolResult> {
  try {
    // Read file and compute SHA-256 hash
    const fileBuffer = await readFile(args.filePath);
    const hash = createHash('sha256').update(fileBuffer).digest('hex');
    const filename = args.filename ?? basename(args.filePath);

    // Get presigned upload URL
    // SDK types say `url` but the API returns `uploadUrl` and `uploadId`
    const upload = await sdk.media.getUploadUrlForTranscode(hash, filename);
    const uploadUrl = (upload as Record<string, unknown>).uploadUrl as string | undefined;
    const uploadId = ((upload as Record<string, unknown>).uploadId as string | undefined) ?? hash;

    // uploadUrl is null when Yoto already has this file (same SHA-256)
    if (uploadUrl) {
      // Upload file directly — the SDK's uploadFile sends the Authorization header
      // along with the presigned URL, which S3 rejects
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/mpeg' },
        body: fileBuffer,
      });

      if (!uploadResponse.ok) {
        const body = await uploadResponse.text();
        return toolError(`S3 upload failed (${uploadResponse.status}): ${body}`);
      }
    }

    // Poll for transcode completion — may take minutes for large files
    const transcode = await pollTranscode(sdk, uploadId);

    return toolResult({
      mediaUrl: transcode.mediaUrl,
      status: transcode.status,
      duration: transcode.duration,
      fileSize: transcode.fileSize,
      filename,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(`Failed to upload audio: ${message}`);
  }
}
