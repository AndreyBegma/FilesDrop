'use client';

import { Button } from '@andrewbehma/glass-ui/button';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  nextTheme,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type Theme,
  themeAttribute,
} from './theme';

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const attribute = themeAttribute(theme);
  if (attribute) root.dataset.theme = attribute;
  else delete root.dataset.theme;
  // biome-ignore lint/suspicious/noDocumentCookie: one cookie, no library needed.
  document.cookie = attribute
    ? `${THEME_COOKIE}=${attribute}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
    : `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/**
 * One button that walks System → Light → Dark. The icon shows the current
 * choice; the name says it and what the next press does. `initial` comes
 * from the `FD_THEME` cookie, read on the server.
 */
export function ThemeSwitcher({ initial }: { initial: Theme }) {
  const t = useTranslations('Shell');
  const [theme, setTheme] = useState<Theme>(initial);
  // Announced after a press only, not on page load.
  const [announce, setAnnounce] = useState(false);
  const Icon = ICONS[theme];
  const label = t('theme', { mode: theme });
  const hint = t('themeNext', { mode: nextTheme(theme) });

  return (
    <>
      <Button
        variant="ghost"
        icon
        onClick={() => {
          const next = nextTheme(theme);
          applyTheme(next);
          setTheme(next);
          setAnnounce(true);
        }}
        aria-label={label}
        title={`${label}. ${hint}`}
        className="size-11 rounded-full"
      >
        <Icon aria-hidden="true" className="size-5" strokeWidth={2} />
      </Button>
      <span role="status" className="sr-only">
        {announce ? label : ''}
      </span>
    </>
  );
}
