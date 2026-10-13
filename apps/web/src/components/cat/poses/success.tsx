'use client';

import { C } from '../palette';
import { SIT_PATCHES, SittingCat } from '../parts/body';
import { Badge, Sparkle } from '../parts/props';

const SPARKLES = [
  {
    d: 'M82 92L87 104L99 109L87 114L82 126L77 114L65 109L77 104Z',
    center: [82, 109],
  },
  {
    d: 'M62 168L65 175L72 178L65 181L62 188L59 181L52 178L59 175Z',
    center: [62, 178],
  },
  {
    d: 'M338 168L341 175L348 178L341 181L338 188L335 181L328 178L335 175Z',
    center: [338, 178],
  },
] as const;

/** success.svg: eyes closed, smiling, sparkles, green check. */
export function SuccessPose() {
  return (
    <>
      <SittingCat
        patches={SIT_PATCHES}
        chest
        paws="pair"
        breathe
        head={{
          x: 200,
          y: 140,
          mouth: 'grin',
          eyes: {
            kind: 'closed',
            d: 'M-47 -1Q-34 -18-21 -1M21 -1Q34 -18 47 -1',
          },
        }}
      />
      <Badge cx={316} cy={92} r={30} fill={C.ok}>
        <path
          d="M302 92L312 102L331 82"
          fill="none"
          stroke={C.fur}
          strokeWidth={7}
        />
      </Badge>
      {SPARKLES.map((s, i) => (
        <Sparkle key={s.d} d={s.d} center={s.center} delay={i * 0.45} />
      ))}
    </>
  );
}
