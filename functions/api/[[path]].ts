/**
 * Cloudflare Pages Function: reverse-proxy every `/api/*` request to the API origin (`API_ORIGIN` in wrangler.toml).
 *
 * Why a proxy and not CORS: the API's refresh cookie is `httpOnly; SameSite=Strict`, so the browser only sends it
 * to the origin that set it. Proxying keeps the SPA and `/api` on one origin — exactly what nginx did in the
 * compose stack — so login/refresh work unchanged and no CORS allow-list is needed.
 *
 * The upstream sees the real client IP via `X-Forwarded-For` (Cloudflare's `CF-Connecting-IP`); Fly's edge
 * appends its own hop, and the API peels both (ForwardedHeaders:ForwardLimit = 2).
 */
interface Env {
  API_ORIGIN: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const origin = (env.API_ORIGIN ?? '').replace(/\/+$/, '');
  if (!origin) {
    return new Response('API_ORIGIN is not configured', { status: 500 });
  }

  const incoming = new URL(request.url);
  const upstream = new URL(origin);
  upstream.pathname = incoming.pathname;
  upstream.search = incoming.search;

  const headers = new Headers(request.headers);
  // `Host` is derived from the upstream URL by fetch(); make sure a stale one never leaks through.
  headers.delete('host');
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) {
    headers.set('x-forwarded-for', clientIp);
  }
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-forwarded-host', incoming.host);

  const init: RequestInit = {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  };

  const response = await fetch(upstream.toString(), init);
  // Response headers from fetch() are immutable; re-wrap so Set-Cookie and friends pass through untouched.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
