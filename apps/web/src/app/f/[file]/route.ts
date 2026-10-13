/**
 * `/f/<slug>.<ext>`: the raw link (Decision 3). The bytes are streamed from
 * the API as they arrive — `upstream.body` goes straight into the response,
 * never read here — so a 90 MB file costs no more memory than a 1 KB one.
 * Range, conditional requests, HEAD, the status and the serving headers
 * (Decision 4) pass through unchanged.
 */

export const dynamic = 'force-dynamic';

const REQUEST_HEADERS = [
  'range',
  'if-range',
  'if-none-match',
  'if-modified-since',
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
] as const;

function upstreamUrl(file: string): string {
  const base = (
    process.env.API_INTERNAL_URL ?? 'http://localhost:7347'
  ).replace(/\/+$/, '');
  return `${base}/f/${encodeURIComponent(file)}`;
}

async function proxy(
  request: Request,
  { params }: { params: Promise<{ file: string }> },
  method: 'GET' | 'HEAD',
): Promise<Response> {
  const { file } = await params;
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl(file), {
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
