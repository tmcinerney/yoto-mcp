import type { YotoSdk } from '@yotoplay/yoto-sdk';
import { vi } from 'vitest';

/**
 * Creates a mock YotoSdk with all methods stubbed.
 * Override specific methods as needed per test.
 */
export function createMockSdk(): YotoSdk {
  return {
    content: {
      getMyCards: vi.fn(),
      getCard: vi.fn(),
      updateCard: vi.fn(),
      deleteCard: vi.fn(),
    },
    devices: {
      getMyDevices: vi.fn(),
    },
    media: {
      getUploadUrlForTranscode: vi.fn(),
      uploadFile: vi.fn(),
      getTranscodedUpload: vi.fn(),
      getMediaUrl: vi.fn(),
      clearMediaCache: vi.fn(),
    },
    icons: {
      getDisplayIcons: vi.fn(),
    },
    family: {
      getFamilyImage: vi.fn(),
      getFamilyImages: vi.fn(),
    },
    familyLibraryGroups: {
      getGroups: vi.fn(),
      createGroup: vi.fn(),
      getGroup: vi.fn(),
      updateGroup: vi.fn(),
      deleteGroup: vi.fn(),
    },
    clearMediaCache: vi.fn(),
    extractMediaId: vi.fn(),
    getConfig: vi.fn(),
    getClientId: vi.fn(),
    getAuthDomain: vi.fn(),
    getAudience: vi.fn(),
    getAccessToken: vi.fn(),
    login: vi.fn(),
    handleCallback: vi.fn(),
    logout: vi.fn(),
  } as unknown as YotoSdk;
}
