import { cn } from '@andrewbehma/glass-ui/cn';

const EAR_LEFT = 'M-66 -28C-74 -60-52 -74-30 -58Z';
const EAR_RIGHT = 'M66 -28C74 -60 52 -74 30 -58Z';
const MASK =
  'M-73 4C-76 -40-40 -64 0 -64C40 -64 76 -40 73 4C66 30 34 30 18 6C12 -14 6 -36 0 -46C-6 -36-12 -14-18 6C-34 30-66 30-73 4Z';

/**
 * Placeholder brand mark: the Scottish Fold's head from `favicon.svg`,
 * reduced to its shapes and given a white sticker edge so it reads on the
 * night sky too. The mascot slot replaces it with the real `<Cat>` head.
 * Decorative: the link around it carries the accessible name.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-88 -84 176 164"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <g className="fd-mark-sticker">
        <path d={EAR_LEFT} />
        <path d={EAR_RIGHT} />
        <ellipse cx="0" cy="0" rx="74" ry="64" />
      </g>
      <path className="fd-mark-ink" d={EAR_LEFT} />
      <path className="fd-mark-ink" d={EAR_RIGHT} />
      <ellipse className="fd-mark-face" cx="0" cy="0" rx="74" ry="64" />
      <path className="fd-mark-ink" d={MASK} />
      <circle className="fd-mark-eye" cx="-34" cy="-6" r="17" />
      <circle className="fd-mark-eye" cx="34" cy="-6" r="17" />
      <circle className="fd-mark-ink" cx="-34" cy="-6" r="10" />
      <circle className="fd-mark-ink" cx="34" cy="-6" r="10" />
      <circle className="fd-mark-fur" cx="-37" cy="-10" r="3.5" />
      <circle className="fd-mark-fur" cx="31" cy="-10" r="3.5" />
      <path className="fd-mark-nose" d="M-9 14H9L0 24Z" />
    </svg>
  );
}
