'use client';

import type { CSSProperties } from 'react';
import { Head } from './parts/head';
import { FAVICON_HEAD } from './poses/favicon';

export interface CatHeadProps {
  /** Width and height in px. */
  size?: number;
  /** Accessible name, already localized. Without it the head is decorative. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The cat's head from favicon.svg, cropped tight: the logo mark.
 * Static on purpose; the animated cat lives in `<Cat>`.
 */
export function CatHead({ size = 32, label, className, style }: CatHeadProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-79 -79 158 158"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={className}
      style={{ display: 'block', ...style }}
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        <Head {...FAVICON_HEAD} />
      </g>
    </svg>
  );
}
