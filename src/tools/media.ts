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
    const upload = await sdk.media.getUploadUrlForTranscode(hash, filename);

    if (!upload.url) {
      return toolError(`Presigned URL missing from upload response: ${JSON.stringify(upload)}`);
    }

    // Upload file to presigned URL
    await sdk.media.uploadFile(upload.url, fileBuffer as Buffer);

    // Poll for transcode completion
    // uploadId derived from presigned URL fields — the SDK uses the key field
    const uploadId = upload.fields?.key ?? hash;
    const transcode = await sdk.media.getTranscodedUpload(uploadId);

    return toolResult({
      mediaUrl: transcode.url,
      status: transcode.status,
      filename,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    return toolError(`Failed to upload audio: ${message}\n${stack}`);
  }
}
