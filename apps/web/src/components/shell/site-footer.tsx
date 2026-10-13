import { PawPrint } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('Shell');
  return (
    <footer className="px-4 pt-16 pb-10 text-center text-label text-balance text-ink-2">
      <p>
        <PawPrint
          aria-hidden="true"
          className="mr-1.5 inline size-3.5 -translate-y-px align-middle"
        />
        {t('footer')}
      </p>
    </footer>
  );
}
