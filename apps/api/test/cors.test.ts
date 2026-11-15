import { connectTest } from '@parking/db/testing';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { webOriginFromEnv } from '../src/cors.ts';
import { appWithLogs } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());

const WEB_ORIGIN = 'https://parking.example.org';
const LATITUDE = '40.71234';
const LONGITUDE = '-73.98765';

describe('cross-origin access for the web app (ADR-0023)', () => {
  it('FND-7 lets the web app\'s origin read a GET response', async () => {
    const { app } = await appWithLogs(sql, { webOrigin: WEB_ORIGIN });

    const response = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: WEB_ORIGIN } });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(response.headers.vary).toContain('Origin');
  });

  it('FND-7 lets the web app read an error\'s code too', async () => {
    const { app } = await appWithLogs(sql, { webOrigin: WEB_ORIGIN });

    const response = await app.inject({
      method: 'GET',
      url: '/api/parking/recommendations?lat=north&lng=-73.987',
      headers: { origin: WEB_ORIGIN },
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'request.invalid_parameter' });
    expect(response.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
  });

  it('FND-7 gives any other origin no CORS headers', async () => {
    const { app } = await appWithLogs(sql, { webOrigin: WEB_ORIGIN });

    const response = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://elsewhere.example' } });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers.vary).toContain('Origin');
  });

  it('FND-7 sends no CORS headers when WEB_ORIGIN isn\'t set', async () => {
    const { app } = await appWithLogs(sql);

    const response = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: WEB_ORIGIN } });
    await app.close();

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers.vary).toBeUndefined();
  });

  it('FND-7 answers a preflight for GET from the web app, and PRIV-2 logs no URL for it', async () => {
    const { app, logs } = await appWithLogs(sql, { webOrigin: WEB_ORIGIN });

    const response = await app.inject({
      method: 'OPTIONS',
      url: `/api/parking/recommendations?lat=${LATITUDE}&lng=${LONGITUDE}`,
      headers: { origin: WEB_ORIGIN, 'access-control-request-method': 'GET' },
    });
    await app.close();

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(response.headers['access-control-allow-methods']).toBe('GET');
    expect(logs.entries.find((entry) => entry.msg === 'request')).toMatchObject({ method: 'OPTIONS', route: null, statusCode: 204 });
    expect(logs.text).not.toContain(LATITUDE);
    expect(logs.text).not.toContain(LONGITUDE);
    expect(logs.text).not.toMatch(/lat=|lng=|\?/);
  });

  it('FND-7 doesn\'t allow other methods: a preflight for POST gets the usual 405', async () => {
    const { app } = await appWithLogs(sql, { webOrigin: WEB_ORIGIN });

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/sources',
      headers: { origin: WEB_ORIGIN, 'access-control-request-method': 'POST' },
    });
    await app.close();

    expect(response.statusCode).toBe(405);
    expect(response.json()).toEqual({ code: 'method_not_allowed' });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('FND-7 reads WEB_ORIGIN at startup as an origin with no path', () => {
    expect(webOriginFromEnv({})).toBeNull();
    expect(webOriginFromEnv({ WEB_ORIGIN: ' ' })).toBeNull();
    expect(webOriginFromEnv({ WEB_ORIGIN: 'https://parking.example.org' })).toBe('https://parking.example.org');
    expect(webOriginFromEnv({ WEB_ORIGIN: 'https://parking.example.org/' })).toBe('https://parking.example.org');
    expect(webOriginFromEnv({ WEB_ORIGIN: 'http://localhost:5180' })).toBe('http://localhost:5180');
    for (const bad of ['parking.example.org', 'https://parking.example.org/app', 'ftp://parking.example.org', 'https://parking.example.org?x=1']) {
      expect(() => webOriginFromEnv({ WEB_ORIGIN: bad }), bad).toThrow(/WEB_ORIGIN/);
    }
  });
});
