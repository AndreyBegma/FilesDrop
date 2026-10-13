import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DropExperience } from '@/components/drop/drop-experience';

/**
 * Home: the headline, then the drop zone with the cat as the hero, the TTL
 * and URL controls, and the cards of what was just uploaded.
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
    <div className="flex flex-col items-center pt-10 text-center sm:pt-16 xl:pt-14">
      <h1 className="max-w-[12em] font-display text-[clamp(2.125rem,6vw,3.5rem)] xl:text-[4rem] leading-[1.04] font-black tracking-[-0.03em] text-balance text-ink">
        {t('title')}
      </h1>
      <p className="mt-4 max-w-[40ch] text-[1.0625rem] xl:max-w-[46ch] xl:text-[1.1875rem] leading-relaxed text-balance text-ink-2">
        {t('tagline')}
      </p>
      <DropExperience />
    </div>
  );
}
