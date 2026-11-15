// FND-7 (ADR-0023): in production the web app is served from its own domain and calls the API on another, so the
// browser asks the API whether it may share each response. The API says yes to one origin only, the web app's, from
// WEB_ORIGIN, and only for reads. Any other origin gets no CORS headers, so browsers keep the response from its page.
// Without WEB_ORIGIN (development and the smoke test, where Vite serves /api on the web app's own origin), there are
// no CORS headers at all.
import type { FastifyInstance } from 'fastify';

/** WEB_ORIGIN, checked at startup: an http(s) origin with no path, such as `https://example.org`. */
export function webOriginFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.WEB_ORIGIN?.trim();
  if (!value) return null;
  const url = URL.parse(value);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:') || url.origin !== value.replace(/\/$/, '')) {
    throw new Error('WEB_ORIGIN must be an origin with no path, such as https://example.org');
  }
  return url.origin;
}

/** How long a browser may reuse a preflight answer, in seconds. */
const PREFLIGHT_MAX_AGE = '600';

export function registerCors(app: FastifyInstance, webOrigin: string | null): void {
  if (!webOrigin) return;
  app.addHook('onRequest', async (request, reply) => {
    // The answer depends on the Origin header, so caches have to keep one copy per origin.
    reply.header('vary', 'Origin');
    if (request.headers.origin !== webOrigin) return;
    if (request.method === 'GET' || request.method === 'HEAD') {
      reply.header('access-control-allow-origin', webOrigin);
      return;
    }
    // The web app's requests are simple GETs, which browsers send without asking first. A preflight is answered
    // anyway, for reads only, so a browser that does ask isn't refused.
    if (request.method === 'OPTIONS' && request.headers['access-control-request-method'] === 'GET') {
      reply
        .header('access-control-allow-origin', webOrigin)
        .header('access-control-allow-methods', 'GET')
        .header('access-control-max-age', PREFLIGHT_MAX_AGE)
        .code(204);
      return reply.send();
    }
  });
}
