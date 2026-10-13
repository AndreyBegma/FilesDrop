/**
 * `/f/<slug>.<ext>`: the raw link (Decision 3). The bytes are streamed from
 * the API as they arrive — `upstream.body` goes straight into the response,
 * never read here — so a 90 MB file costs no more memory than a 1 KB one.
 * Range, conditional requests, HEAD, the status and the serving headers
 * (Decision 4) pass through unchanged.
 *
 * A password-protected file needs the access token from unlocking it, as
 * `?k=` or `X-File-Access`; both are forwarded. Without one the API answers
 * 401, and a person following the link is sent to `/v/<slug>` to unlock it.
 */

export const dynamic = 'force-dynamic';

const REQUEST_HEADERS = [
  'range',
  'if-range',
  'if-none-match',
  'if-modified-since',
  'x-file-access',
] as const;

const RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'content-disposition',
  'accept-ranges',
  'cache-control',
  'etag',
  'last-modified',
  'x-content-type-options',
  'content-security-policy',
  'cross-origin-resource-policy',
  'referrer-policy',
] as const;

const SLUG = /^[A-Za-z0-9]{1,32}$/;

function upstreamUrl(file: string, access: string | null): string {
  const base = (
    process.env.API_INTERNAL_URL ?? 'http://localhost:7347'
  ).replace(/\/+$/, '');
  const query = access ? `?k=${encodeURIComponent(access)}` : '';
  return `${base}/f/${encodeURIComponent(file)}${query}`;
}

async function proxy(
  request: Request,
  { params }: { params: Promise<{ file: string }> },
  method: 'GET' | 'HEAD',
): Promise<Response> {
  const { file } = await params;
  const access = new URL(request.url).searchParams.get('k');
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl(file, access), {
      method,
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal: request.signal,
    });
  } catch {
    return Response.json(
      { statusCode: 502, error: 'Bad Gateway' },
      { status: 502 },
    );
  }

  // Locked and no (valid) token: the lock screen, not a JSON error.
  const slug = file.split('.')[0];
  if (upstream.status === 401 && SLUG.test(slug)) {
    await upstream.body?.cancel();
    return new Response(null, {
      status: 302,
      headers: { location: `/v/${slug}`, 'cache-control': 'no-store' },
    });
  }

  const out = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  // The bytes are already whatever they are; do not let a proxy re-encode
  // them and break Content-Length or a byte range.
  out.set('content-encoding', 'identity');

  return new Response(method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

type Context = { params: Promise<{ file: string }> };

export function GET(request: Request, context: Context) {
  return proxy(request, context, 'GET');
}

export function HEAD(request: Request, context: Context) {
  return proxy(request, context, 'HEAD');
}
