import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { lookupFile } from '../meta';
import { DOWNLOAD_CAT_SVG } from './download-cat';

/**
 * The Open Graph card for a file that is not an image (Open question 3):
 * the `download` cat holding up the file's name. Images use their own raw
 * link instead (see the page's metadata). A locked file gets the same cat
 * with a padlock and a generic title: nothing about the file leaks.
 */

const CAT = `data:image/svg+xml;base64,${Buffer.from(DOWNLOAD_CAT_SVG).toString('base64')}`;

/** Nunito (the display face) for exactly the glyphs on the card. */
async function loadNunito(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Nunito:wght@800&text=${encodeURIComponent(text)}`,
        { signal: AbortSignal.timeout(2500) },
      )
    ).text();
    const url = css.match(
      /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/,
    )?.[1];
    if (!url) return null;
    const font = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return font.ok ? font.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function humanSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 || value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const found = await lookupFile(slug);
  const locked = found.status === 'locked';
  const name =
    found.status === 'ok'
      ? found.meta.name
      : locked
        ? (await getTranslations('Preview'))('lockedOgTitle')
        : 'FilesDrop';
  const detail =
    found.status === 'ok'
      ? `${humanSize(found.meta.size)}${found.meta.ext ? ` · .${found.meta.ext}` : ''}`
      : '';
  const shown = name.length > 60 ? `${name.slice(0, 57)}…` : name;
  const font = await loadNunito(`${shown}${detail}FilesDrop`);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '0 80px',
        gap: 48,
        background:
          'linear-gradient(160deg, #DCE8F5 0%, #EEF2F8 55%, #FFE9A8 100%)',
        fontFamily: font ? 'Nunito' : undefined,
        color: '#1B1B20',
      }}
    >
      <div style={{ display: 'flex', position: 'relative' }}>
        <img src={CAT} width={420} height={420} alt="" />
        {locked ? (
          <div
            style={{
              position: 'absolute',
              right: 24,
              bottom: 40,
              width: 112,
              height: 112,
              borderRadius: 56,
              border: '6px solid #1B1B20',
              background: '#FFE9A8',
              boxShadow: '0 8px 0 #1B1B20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: satori draws a <title> as text; the card is an image with its own alt. */}
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1B1B20"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: shown.length > 28 ? 52 : 68,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            wordBreak: 'break-word',
          }}
        >
          {shown}
        </div>
        {detail ? (
          <div style={{ marginTop: 20, fontSize: 32, color: '#4A4A55' }}>
            {detail}
          </div>
        ) : null}
        <div
          style={{
            marginTop: 40,
            display: 'flex',
            fontSize: 30,
            fontWeight: 800,
            color: '#3B6FE0',
          }}
        >
          FilesDrop
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: font
        ? [{ name: 'Nunito', data: font, weight: 800, style: 'normal' }]
        : undefined,
      headers: { 'cache-control': 'public, max-age=300' },
    },
  );
}
