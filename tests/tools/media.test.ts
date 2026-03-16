import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleUploadAudio } from '../../src/tools/media.js';
import { createMockSdk } from './helpers.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('abc123hash'),
  })),
}));

import { readFile, stat } from 'node:fs/promises';

// Helpers matching actual Yoto API response shapes
function mockUploadUrl(uploadUrl: string | null, uploadId = 'test-upload-id') {
  return { uploadUrl, uploadId } as never;
}

function mockTranscodeComplete(sha256: string, duration = 120, fileSize = 5000) {
  return {
    progress: { phase: 'complete', percent: 100 },
    transcodedSha256: sha256,
    transcodedInfo: { duration, fileSize },
  } as never;
}

function mockTranscodeProcessing(percent = 50) {
  return { progress: { phase: 'processing', percent } } as never;
}

function mockFetchOk() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
}

function mockFetchError(status: number, body: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })));
}

describe('handleUploadAudio', () => {
  beforeEach(() => {
    vi.mocked(readFile).mockClear();
    vi.mocked(stat).mockClear();
    vi.restoreAllMocks();
    // Default stat mock: small file under size limit
    vi.mocked(stat).mockResolvedValue({ size: 1024 } as never);
  });

  it('uploads and returns yoto:# media URL from transcode', async () => {
    const sdk = createMockSdk();
    const fileBuffer = Buffer.from('fake-audio-data');

    vi.mocked(readFile).mockResolvedValue(fileBuffer);
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl('https://s3.example.com/presigned'),
    );
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue(
      mockTranscodeComplete('abc123transcoded', 120, 5000),
    );

    const result = await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.mediaUrl).toBe('yoto:#abc123transcoded');
    expect(data.duration).toBe(120);
    expect(data.fileSize).toBe(5000);
    expect(data.filename).toBe('audio.mp3');

    expect(fetch).toHaveBeenCalledWith('https://s3.example.com/presigned', {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/mpeg' },
      body: fileBuffer,
      signal: expect.any(AbortSignal),
    });
    expect(sdk.media.uploadFile).not.toHaveBeenCalled();
  });

  it('skips upload when file already exists (null uploadUrl)', async () => {
    const sdk = createMockSdk();
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl(null, 'existing-id'),
    );
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue(
      mockTranscodeComplete('existing-hash'),
    );

    const result = await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.mediaUrl).toBe('yoto:#existing-hash');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('polls until transcode completes', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl('https://s3.example.com/presigned'),
    );
    mockFetchOk();

    let callCount = 0;
    vi.mocked(sdk.media.getTranscodedUpload).mockImplementation(async () => {
      callCount++;
      if (callCount < 3) return mockTranscodeProcessing(callCount * 33);
      return mockTranscodeComplete('done-hash');
    });

    // Skip poll delays
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

  it('uses uploadId from response for polling', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl('https://s3.example.com/presigned', 'custom-upload-id'),
    );
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue(mockTranscodeComplete('hash'));

    await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    expect(sdk.media.getTranscodedUpload).toHaveBeenCalledWith('custom-upload-id');
  });

  it('falls back to file hash when uploadId is missing', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      uploadUrl: 'https://s3.example.com/presigned',
    } as never);
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue(mockTranscodeComplete('hash'));

    await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    expect(sdk.media.getTranscodedUpload).toHaveBeenCalledWith('abc123hash');
  });

  it('uses custom filename when provided', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl('https://s3.example.com/presigned'),
    );
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue(mockTranscodeComplete('hash'));

    const result = await handleUploadAudio(sdk, {
      filePath: '/tmp/audio.mp3',
      filename: 'my-song.mp3',
    });

    expect(sdk.media.getUploadUrlForTranscode).toHaveBeenCalledWith('abc123hash', 'my-song.mp3');
    const data = JSON.parse(result.content[0].text);
    expect(data.filename).toBe('my-song.mp3');
  });

  it('errors when transcodedSha256 is missing from complete response', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl('https://s3.example.com/presigned'),
    );
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue({
      progress: { phase: 'complete', percent: 100 },
    } as never);

    const result = await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('transcodedSha256 is missing');
  });

  it('errors when S3 upload fails', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl('https://s3.example.com/presigned'),
    );
    mockFetchError(403, 'Access Denied');

    const result = await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('S3 upload failed (403)');
  });

  it('errors when file read fails', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await handleUploadAudio(sdk, { filePath: '/tmp/nonexistent.mp3' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ENOENT');
  });

  it('errors when transcode request fails', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl('https://s3.example.com/presigned'),
    );
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockRejectedValue(new Error('Transcode API error'));

    const result = await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Transcode API error');
  });

  // --- Batch 3: Content-Type from file extension ---

  it('uses audio/mpeg Content-Type for .mp3 files', async () => {
    const sdk = createMockSdk();
    const fileBuffer = Buffer.from('fake-mp3');

    vi.mocked(readFile).mockResolvedValue(fileBuffer);
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl('https://s3.example.com/presigned'),
    );
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue(mockTranscodeComplete('hash'));

    await handleUploadAudio(sdk, { filePath: '/tmp/song.mp3' });

    expect(fetch).toHaveBeenCalledWith(
      'https://s3.example.com/presigned',
      expect.objectContaining({
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    );
  });

  it('uses audio/mp4 Content-Type for .m4a files', async () => {
    const sdk = createMockSdk();
    const fileBuffer = Buffer.from('fake-m4a');

    vi.mocked(readFile).mockResolvedValue(fileBuffer);
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl('https://s3.example.com/presigned'),
    );
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue(mockTranscodeComplete('hash'));

    await handleUploadAudio(sdk, { filePath: '/tmp/audiobook.m4a' });

    expect(fetch).toHaveBeenCalledWith(
      'https://s3.example.com/presigned',
      expect.objectContaining({
        headers: { 'Content-Type': 'audio/mp4' },
      }),
    );
  });

  it('uses application/octet-stream for unknown extensions', async () => {
    const sdk = createMockSdk();
    const fileBuffer = Buffer.from('fake-unknown');

    vi.mocked(readFile).mockResolvedValue(fileBuffer);
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl('https://s3.example.com/presigned'),
    );
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue(mockTranscodeComplete('hash'));

    await handleUploadAudio(sdk, { filePath: '/tmp/mystery.xyz' });

    expect(fetch).toHaveBeenCalledWith(
      'https://s3.example.com/presigned',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/octet-stream' },
      }),
    );
  });

  // --- Batch 3: Upload timeout ---

  it('aborts S3 upload after timeout', async () => {
    const sdk = createMockSdk();
    const fileBuffer = Buffer.from('fake-audio');

    vi.mocked(readFile).mockResolvedValue(fileBuffer);
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue(
      mockUploadUrl('https://s3.example.com/presigned'),
    );
    mockFetchOk();
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue(mockTranscodeComplete('hash'));

    await handleUploadAudio(sdk, { filePath: '/tmp/audio.mp3' });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const fetchOptions = fetchCall[1] as RequestInit;
    expect(fetchOptions.signal).toBeDefined();
    expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
  });

  // --- Batch 3: File size guard ---

  it('rejects files exceeding size limit', async () => {
    const sdk = createMockSdk();
    const SIZE_600MB = 600 * 1024 * 1024;

    vi.mocked(stat).mockResolvedValue({ size: SIZE_600MB } as never);
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

    const result = await handleUploadAudio(sdk, { filePath: '/tmp/huge-file.mp3' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/size|too large|limit|exceed/i);
  });
});
