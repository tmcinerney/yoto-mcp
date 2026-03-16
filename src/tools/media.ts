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

// Actual API response shapes — the SDK types don't match the real API
interface UploadUrlApiResponse {
  uploadUrl: string | null;
  uploadId: string;
}

interface TranscodeApiResponse {
  progress?: { phase: string; percent: number };
  transcodedSha256?: string;
  transcodedInfo?: { duration: number; fileSize: number };
}

const TRANSCODE_POLL_INTERVAL_MS = 10_000;
const TRANSCODE_MAX_WAIT_MS = 15 * 60_000;

function isTranscodeComplete(response: TranscodeApiResponse): boolean {
  return response.progress?.phase === 'complete';
}

function buildMediaUrl(response: TranscodeApiResponse): string {
  if (!response.transcodedSha256) {
    throw new Error('Transcode completed but transcodedSha256 is missing from response');
  }
  return `yoto:#${response.transcodedSha256}`;
}

async function pollTranscode(sdk: YotoSdk, uploadId: string): Promise<TranscodeApiResponse> {
  const deadline = Date.now() + TRANSCODE_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const response = (await sdk.media.getTranscodedUpload(
      uploadId,
    )) as unknown as TranscodeApiResponse;

    if (isTranscodeComplete(response)) {
      return response;
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
    const fileBuffer = await readFile(args.filePath);
    const hash = createHash('sha256').update(fileBuffer).digest('hex');
    const filename = args.filename ?? basename(args.filePath);

    // SDK types don't match the real API — cast to actual response shape
    const upload = (await sdk.media.getUploadUrlForTranscode(
      hash,
      filename,
    )) as unknown as UploadUrlApiResponse;

    // uploadUrl is null when Yoto already has this file (same SHA-256)
    if (upload.uploadUrl) {
      // Upload directly with fetch — the SDK's uploadFile leaks the
      // Authorization header to the presigned S3 URL, causing a 400
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/mpeg' },
        body: fileBuffer,
      });

      if (!response.ok) {
        const body = await response.text();
        return toolError(`S3 upload failed (${response.status}): ${body}`);
      }
    }

    const transcode = await pollTranscode(sdk, upload.uploadId ?? hash);
    const mediaUrl = buildMediaUrl(transcode);

    return toolResult({
      mediaUrl,
      duration: transcode.transcodedInfo?.duration,
      fileSize: transcode.transcodedInfo?.fileSize,
      filename,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(`Failed to upload audio: ${message}`);
  }
}
