import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiOriginFrom } from '../config.ts';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('the API client', () => {
  it('FND-7 calls the API on its own domain when VITE_API_ORIGIN is set at build time', async () => {
    vi.stubEnv('VITE_API_ORIGIN', 'https://api.parking.example.org/');
    const fetch = vi.fn(async (_request: Request) => Response.json({ status: 'ok' }));
    vi.stubGlobal('fetch', fetch);
    // config.ts reads the setting once, when it loads, so it's loaded again here.
    vi.resetModules();

    const { apiClient } = await import('./apiClient.ts');
    await apiClient.GET('/api/health');

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0].url).toBe('https://api.parking.example.org/api/health');
  });

  it('FND-7 keeps the API on the web app\'s own origin when VITE_API_ORIGIN isn\'t set', () => {
    expect(apiOriginFrom(undefined)).toBe('');
    expect(apiOriginFrom('  ')).toBe('');
    expect(apiOriginFrom(' https://api.parking.example.org// ')).toBe('https://api.parking.example.org');
  });
});
