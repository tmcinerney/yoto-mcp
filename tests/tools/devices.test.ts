import type { Device } from '@yotoplay/yoto-sdk';
import { describe, expect, it, vi } from 'vitest';
import { handleListDevices } from '../../src/tools/devices.js';
import { createMockSdk } from './helpers.js';

const MOCK_DEVICES: Device[] = [
  {
    id: 'device-1',
    name: 'Kids Room Yoto',
    type: 'v3',
    status: 'online',
    lastSeen: '2026-03-15T10:00:00Z',
    firmwareVersion: '2.1.0',
  },
  {
    id: 'device-2',
    name: 'Living Room Yoto',
    type: 'v3',
    status: 'offline',
  },
];

describe('handleListDevices', () => {
  it('returns formatted device list', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.devices.getMyDevices).mockResolvedValue(MOCK_DEVICES);

    const result = await handleListDevices(sdk);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe('device-1');
    expect(data[0].name).toBe('Kids Room Yoto');
    expect(data[1].status).toBe('offline');
  });

  it('returns empty array when no devices', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.devices.getMyDevices).mockResolvedValue([]);

    const result = await handleListDevices(sdk);

    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual([]);
  });

  it('returns error when SDK throws', async () => {
    const sdk = createMockSdk();
    vi.mocked(sdk.devices.getMyDevices).mockRejectedValue(new Error('Network error'));

    const result = await handleListDevices(sdk);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Network error');
  });
});
