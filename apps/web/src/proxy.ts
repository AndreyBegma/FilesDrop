import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { negotiateLocale } from './i18n/negotiate';
import { retiredLocaleRedirect } from './i18n/retired';
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  routing,
} from './i18n/routing';

const intl = createMiddleware(routing);

/**
 * A `NEXT_LOCALE` cookie naming a locale we no longer serve counts as absent:
 * the locale is negotiated again and the cookie overwritten, unless next-intl
 * already set it on this response.
 */
function replaceStaleCookie(request: NextRequest, response: NextResponse) {
  const stale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (stale === undefined || isLocale(stale)) return response;
  if (response.cookies.get(LOCALE_COOKIE)) return response;
  response.cookies.set(
    LOCALE_COOKIE,
    negotiateLocale(request.headers.get('accept-language')),
    { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax' },
  );
  return response;
}

/**
 * Next 16 names the request interceptor `proxy.ts` (formerly
 * `middleware.ts`). It redirects `/` once — by the `NEXT_LOCALE` cookie,
 * then `Accept-Language`, then English — and keeps the prefix on every page.
 * `/v/…` stays unprefixed (Decision 11); the proxy only tidies its cookie.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // `/ru` and `/ru/…` were retired: 308 to the same page in English.
  const redirect = retiredLocaleRedirect(pathname);
  if (redirect) {
    const url = request.nextUrl.clone();
    url.pathname = redirect;
    return NextResponse.redirect(url, 308);
  }

  if (pathname.startsWith('/v/')) {
    return replaceStaleCookie(request, NextResponse.next());
  }
  return replaceStaleCookie(request, intl(withNegotiatedLanguage(request)));
}

/**
 * next-intl's own "best fit" matcher treats Russian as close enough to
 * Ukrainian and sends `Accept-Language: ru` to `/uk`. We want anything but
 * Ukrainian to land on English, so next-intl only ever sees the one locale
 * `negotiateLocale` picked.
 */
function withNegotiatedLanguage(request: NextRequest): NextRequest {
  const headers = new Headers(request.headers);
  headers.set(
    'accept-language',
    negotiateLocale(request.headers.get('accept-language')),
  );
  return new NextRequest(request, { headers });
}

export const config = {
  // Everything except: API and Next internals, the raw (`/f/…`) and preview
  // (`/v/…`) links, which have no locale prefix (Decision 11), and files.
  // `/v/<slug>` itself is matched only so a stale locale cookie is replaced.
  matcher: ['/((?!api|_next|_vercel|f/|v/|f$|v$|.*\\..*).*)', '/v/:slug'],
};
