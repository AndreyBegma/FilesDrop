import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Next 16 names the request interceptor `proxy.ts` (formerly
 * `middleware.ts`). It redirects `/` once — by the `NEXT_LOCALE` cookie,
 * then `Accept-Language`, then English — and keeps the prefix on every page.
 */
export default createMiddleware(routing);

export const config = {
  // Everything except: API and Next internals, the raw (`/f/…`) and preview
  // (`/v/…`) links, which have no locale prefix (Decision 11), and files.
  matcher: ['/((?!api|_next|_vercel|f/|v/|f$|v$|.*\\..*).*)'],
};
