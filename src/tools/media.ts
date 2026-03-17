import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, isAbsolute, normalize } from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YotoSdk } from '@yotoplay/yoto-sdk';
import { classifyApiError, toolError, toolResult } from './shared.js';

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

// The Yoto SDK hardcodes Content-Type: "audio/mpeg" for all uploads.
// The presigned S3 URL is generated expecting this value — a mismatch
// causes the upload to appear to succeed but produces unplayable transcodes.
// Yoto's transcoder detects the actual format regardless of Content-Type.
const UPLOAD_CONTENT_TYPE = 'audio/mpeg';

export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
const UPLOAD_TIMEOUT_MS = 5 * 60_000;

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
    // Reject relative/traversal paths — only accept absolute paths
    // NFD normalize for macOS filesystem compatibility (HFS+/APFS stores NFD,
    // but JSON transport may deliver NFC — causing ENOENT on emoji/accent paths)
    const normalizedPath = normalize(args.filePath).normalize('NFD');
    if (!isAbsolute(normalizedPath)) {
      return toolError('filePath must be an absolute path');
    }

    // Size guard — prevent loading huge files into memory
    const fileStat = await stat(normalizedPath);
    if (fileStat?.size > MAX_FILE_SIZE_BYTES) {
      return toolError(
        `File too large (${Math.round(fileStat.size / 1024 / 1024)}MB). Maximum is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
      );
    }

    const fileBuffer = await readFile(normalizedPath);
    const hash = createHash('sha256').update(fileBuffer).digest('hex');
    const filename = args.filename ?? basename(normalizedPath);

    // SDK types don't match the real API — cast to actual response shape
    const upload = (await sdk.media.getUploadUrlForTranscode(
      hash,
      filename,
    )) as unknown as UploadUrlApiResponse;

    // uploadUrl is null when Yoto already has this file (same SHA-256)
    if (upload.uploadUrl) {
      // Upload directly with fetch — the SDK's uploadFile leaks the
      // Authorization header to the presigned S3 URL, causing a 400
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
      try {
        const response = await fetch(upload.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': UPLOAD_CONTENT_TYPE },
          body: fileBuffer,
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text();
          return toolError(`S3 upload failed (${response.status}): ${body}`);
        }
      } finally {
        clearTimeout(timeout);
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
    return toolError(classifyApiError('Failed to upload audio', err));
  }
}
