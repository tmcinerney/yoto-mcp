import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleUploadAudio } from '../../src/tools/media.js';
import { createMockSdk } from './helpers.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('abc123hash'),
  })),
}));

import { readFile } from 'node:fs/promises';

function mockFetchOk() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
}

function mockFetchError(status: number, body: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })));
}

describe('handleUploadAudio', () => {
  beforeEach(() => {
    vi.mocked(readFile).mockClear();
    vi.restoreAllMocks();
  });

  it('uploads file through full pipeline: hash → presign → upload → transcode', async () => {
    const sdk = createMockSdk();
    const fileBuffer = Buffer.from('fake-audio-data');

    vi.mocked(readFile).mockResolvedValue(fileBuffer);
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      uploadUrl: 'https://s3.example.com/presigned',
      uploadId: 'upload-id-1',
    } as never);
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue({
      progress: { phase: 'complete', percent: 100 },
      transcodedSha256: 'abc123transcoded',
      transcodedInfo: { duration: 120, fileSize: 5000 },
    } as never);

    const result = await handleUploadAudio(sdk, {
      filePath: '/tmp/audio.mp3',
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.mediaUrl).toBe('yoto:#abc123transcoded');
    expect(data.status).toBe('completed');
    expect(data.duration).toBe(120);

    expect(readFile).toHaveBeenCalledWith('/tmp/audio.mp3');
    expect(sdk.media.getUploadUrlForTranscode).toHaveBeenCalledWith('abc123hash', 'audio.mp3');

    // Verify direct fetch to S3 — not sdk.media.uploadFile
    expect(fetch).toHaveBeenCalledWith('https://s3.example.com/presigned', {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/mpeg' },
      body: fileBuffer,
    });
    expect(sdk.media.uploadFile).not.toHaveBeenCalled();
  });

  it('skips upload when file already exists (null uploadUrl)', async () => {
    const sdk = createMockSdk();
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      uploadUrl: null,
      uploadId: 'existing-id',
    } as never);
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue({
      progress: { phase: 'complete', percent: 100 },
      transcodedSha256: 'existing-hash',
    } as never);

    const result = await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.mediaUrl).toBe('yoto:#existing-hash');
    // Should NOT have called fetch — file was already uploaded
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('polls transcode until url is available', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      uploadUrl: 'https://s3.example.com/presigned',
      uploadId: 'poll-id',
    } as never);
    mockFetchOk();

    let callCount = 0;
    vi.mocked(sdk.media.getTranscodedUpload).mockImplementation(async () => {
      callCount++;
      if (callCount < 3) return { progress: { phase: 'processing', percent: 50 } } as never;
      return {
        progress: { phase: 'complete', percent: 100 },
        transcodedSha256: 'done-hash',
      } as never;
    });

    // Override setTimeout to resolve immediately so polling doesn't wait
    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0;
    });

    const result = await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    vi.unstubAllGlobals();

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.mediaUrl).toBe('yoto:#done-hash');
    expect(sdk.media.getTranscodedUpload).toHaveBeenCalledTimes(3);
  });

  it('uses uploadId from response for transcode polling', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      uploadUrl: 'https://s3.example.com/presigned',
      uploadId: 'custom-upload-id',
    } as never);
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue({
      progress: { phase: 'complete', percent: 100 },
      transcodedSha256: 'media-hash',
    } as never);

    await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    expect(sdk.media.getTranscodedUpload).toHaveBeenCalledWith('custom-upload-id');
  });

  it('falls back to hash when uploadId is missing', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      uploadUrl: 'https://s3.example.com/presigned',
    } as never);
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue({
      progress: { phase: 'complete', percent: 100 },
      transcodedSha256: 'media-hash',
    } as never);

    await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    expect(sdk.media.getTranscodedUpload).toHaveBeenCalledWith('abc123hash');
  });

  it('uses custom filename when provided', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      uploadUrl: 'https://s3.example.com/presigned',
      uploadId: 'upload-id-2',
    } as never);
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue({
      progress: { phase: 'complete', percent: 100 },
      transcodedSha256: 'media-2-hash',
    } as never);

    await handleUploadAudio(sdk, {
      filePath: '/tmp/audio.mp3',
      filename: 'my-song.mp3',
    });

    expect(sdk.media.getUploadUrlForTranscode).toHaveBeenCalledWith('abc123hash', 'my-song.mp3');
  });

  it('returns error when S3 upload fails', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      uploadUrl: 'https://s3.example.com/presigned',
      uploadId: 'id',
    } as never);
    mockFetchError(403, 'Access Denied');

    const result = await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('S3 upload failed (403)');
  });

  it('returns error when file read fails', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await handleUploadAudio(sdk, {
      filePath: '/tmp/nonexistent.mp3',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ENOENT');
  });

  it('returns error when transcode fails', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      uploadUrl: 'https://s3.example.com/presigned',
      uploadId: 'upload-id-3',
    } as never);
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockRejectedValue(new Error('Transcode failed'));

    const result = await handleUploadAudio(sdk, {
      filePath: '/tmp/audio.mp3',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Transcode failed');
  });
});
