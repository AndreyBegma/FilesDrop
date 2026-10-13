import { getRequestConfig } from 'next-intl/server';

// Stub so the next-intl plugin resolves; the i1-shell slot replaces it.
export default getRequestConfig(async () => ({
  locale: 'en',
  messages: {},
}));
