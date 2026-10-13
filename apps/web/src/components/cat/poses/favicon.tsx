'use client';

import { Head, type HeadProps } from '../parts/head';

/** favicon.svg's head, at the head's own origin. */
export const FAVICON_HEAD = {
  x: 0,
  y: 0,
  whiskers: 'none',
  nose: 'big',
  mouth: 'smile-big',
  eyes: {
    kind: 'open',
    irisR: 16,
    pupil: [-34, -6, 10],
    glint: [-37, -10, 3.5],
  },
} as const satisfies HeadProps;

/** favicon.svg: the head alone, scaled 2.2×. */
export function FaviconPose() {
  return <Head {...FAVICON_HEAD} x={200} y={212} scale={2.2} />;
}
