import { Mail, PawPrint, Send } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { CONTACTS, GithubMark } from './contacts';

const TEXT_LINK =
  'flex h-11 items-center gap-2 rounded-full px-3 font-semibold text-ink-2 underline-offset-4 transition-colors duration-(--dur-fast) hover:text-ink hover:underline';
const ICON_LINK =
  'grid size-11 place-items-center rounded-full text-ink-2 transition-colors duration-(--dur-fast) hover:bg-hover hover:text-ink';

/**
 * The pun, then two rows: the project (privacy & rules, source code) and the
 * author's contacts. The two GitHub links carry different names, so a screen
 * reader never confuses the repository with the profile.
 * `getLocale()` resolves the same way on `/[locale]` pages and on `/v/*`
 * (cookie, then Accept-Language), so the privacy link lands on the visitor's
 * language.
 */
export async function SiteFooter() {
  const t = await getTranslations('Shell');
  const locale = await getLocale();
  const newTab = t('newTab');

  return (
    <footer className="px-4 pt-16 pb-10 text-center text-label text-balance text-ink-2">
      <p>
        <PawPrint
          aria-hidden="true"
          className="mr-1.5 inline size-3.5 -translate-y-px align-middle"
        />
        {t('footer')}
      </p>
      <nav aria-label={t('footerNav')} className="mt-3">
        <ul className="flex flex-wrap items-center justify-center gap-x-1">
          <li>
            <Link href={`/${locale}/privacy`} className={TEXT_LINK}>
              {t('privacy')}
            </Link>
          </li>
          <li
            aria-hidden="true"
            className="mx-1 hidden h-4 w-px bg-line-strong sm:block"
          />
          <li>
            <a
              href={CONTACTS.source}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t('sourceName')} ${newTab}`}
              className={TEXT_LINK}
            >
              <GithubMark className="size-4" />
              {t('source')}
            </a>
          </li>
        </ul>
        <div className="mt-1 flex items-center justify-center gap-1">
          <span id="footer-author" className="pr-1 font-semibold">
            {t('author')}
          </span>
          <ul
            aria-labelledby="footer-author"
            className="flex items-center gap-0.5"
          >
            <li>
              <a
                href={CONTACTS.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t('github')} ${newTab}`}
                title={t('github')}
                className={ICON_LINK}
              >
                <GithubMark className="size-[18px]" />
              </a>
            </li>
            <li>
              <a
                href={`mailto:${CONTACTS.email}`}
                aria-label={t('email', { email: CONTACTS.email })}
                title={CONTACTS.email}
                className={ICON_LINK}
              >
                <Mail aria-hidden="true" className="size-[18px]" />
              </a>
            </li>
            <li>
              <a
                href={CONTACTS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t('telegram', { handle: CONTACTS.telegramHandle })} ${newTab}`}
                title={`Telegram ${CONTACTS.telegramHandle}`}
                className={ICON_LINK}
              >
                <Send aria-hidden="true" className="size-[18px]" />
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </footer>
  );
}
