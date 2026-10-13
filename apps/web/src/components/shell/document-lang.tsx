'use client';

import { useEffect } from 'react';

/**
 * The root layout sets `<html lang>` on the first render, but it is shared by
 * every locale and does not re-render on a client-side language switch. This
 * keeps the attribute in step with the `[locale]` segment.
 */
export function DocumentLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
