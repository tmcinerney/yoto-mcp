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

describe('handleUploadAudio', () => {
  beforeEach(() => {
    vi.mocked(readFile).mockClear();
  });

  it('uploads file through full pipeline: hash → presign → upload → transcode', async () => {
    const sdk = createMockSdk();
    const fileBuffer = Buffer.from('fake-audio-data');

    vi.mocked(readFile).mockResolvedValue(fileBuffer);
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      url: 'https://upload.example.com/presigned',
      fields: { key: 'upload-id-1' },
    });
    vi.mocked(sdk.media.uploadFile).mockResolvedValue(undefined);
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue({
      url: 'yoto:#transcoded-media-id',
      status: 'completed',
    });

    const result = await handleUploadAudio(sdk, {
      filePath: '/tmp/audio.mp3',
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.mediaUrl).toBe('yoto:#transcoded-media-id');
    expect(data.status).toBe('completed');

    expect(readFile).toHaveBeenCalledWith('/tmp/audio.mp3');
    expect(sdk.media.getUploadUrlForTranscode).toHaveBeenCalledWith('abc123hash', 'audio.mp3');
    expect(sdk.media.uploadFile).toHaveBeenCalledWith(
      'https://upload.example.com/presigned',
      fileBuffer,
    );
  });

  it('uses custom filename when provided', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      url: 'https://upload.example.com/presigned',
      fields: { key: 'upload-id-2' },
    });
    vi.mocked(sdk.media.uploadFile).mockResolvedValue(undefined);
    vi.mocked(sdk.media.getTranscodedUpload).mockResolvedValue({
      url: 'yoto:#media-2',
      status: 'completed',
    });

    await handleUploadAudio(sdk, {
      filePath: '/tmp/audio.mp3',
      filename: 'my-song.mp3',
    });

    expect(sdk.media.getUploadUrlForTranscode).toHaveBeenCalledWith('abc123hash', 'my-song.mp3');
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

  it('returns error when upload fails', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      url: 'https://upload.example.com/presigned',
    });
    vi.mocked(sdk.media.uploadFile).mockRejectedValue(new Error('Upload failed'));

    const result = await handleUploadAudio(sdk, {
      filePath: '/tmp/audio.mp3',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Upload failed');
  });

  it('returns error when transcode fails', async () => {
    const sdk = createMockSdk();
    vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));
    vi.mocked(sdk.media.getUploadUrlForTranscode).mockResolvedValue({
      url: 'https://upload.example.com/presigned',
      fields: { key: 'upload-id-3' },
    });
    vi.mocked(sdk.media.uploadFile).mockResolvedValue(undefined);
    vi.mocked(sdk.media.getTranscodedUpload).mockRejectedValue(new Error('Transcode failed'));

    const result = await handleUploadAudio(sdk, {
      filePath: '/tmp/audio.mp3',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Transcode failed');
  });
});
