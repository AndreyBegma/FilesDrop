import { ArrowDownToLine } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/**
 * Placeholder hero. The drop slot (`i1-drop`) replaces the box with the real
 * `FileDropzone` and the mascot inside it.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Home');

  return (
    <div className="flex flex-col items-center pt-14 text-center sm:pt-24">
      <h1 className="max-w-[10.5em] font-display text-[clamp(2.25rem,6.5vw,4rem)] leading-[1.02] font-black tracking-[-0.03em] text-balance text-ink">
        {t('title')}
      </h1>
      <p className="mt-5 max-w-[38ch] text-[1.0625rem] leading-relaxed text-balance text-ink-2 sm:text-lg">
        {t('tagline')}
      </p>

      <section
        aria-labelledby="drop-title"
        className="glass mt-10 w-full rounded-sheet p-2.5 sm:mt-14 sm:p-3"
      >
        <div className="flex min-h-[17rem] flex-col items-center justify-center gap-3 rounded-[calc(var(--radius-sheet)-10px)] border-2 border-dashed border-line-strong bg-content px-6 py-10 sm:min-h-[21rem]">
          <span className="mb-2 flex size-16 items-center justify-center rounded-full bg-hover text-ink">
            <ArrowDownToLine aria-hidden="true" className="size-7" />
          </span>
          <h2
            id="drop-title"
            className="font-display text-[1.5rem] leading-tight font-extrabold tracking-[-0.01em] text-ink"
          >
            {t('dropTitle')}
          </h2>
          <p className="text-body text-balance text-ink-2">{t('dropHint')}</p>
          <p className="text-label text-ink-2">{t('dropLimits')}</p>
        </div>
      </section>
    </div>
  );
}
