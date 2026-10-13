'use client';

import { loop, Move } from '../motion';
import { C } from '../palette';
import { Shadow, SIT_PATCHES, SittingCat } from '../parts/body';

const box = { stroke: C.ink, strokeWidth: 4 } as const;

/** not-found.svg: head tilted at an empty box, question mark. */
export function NotFoundPose() {
  return (
    <>
      <Shadow cx={312} cy={376} rx={74} ry={8} />
      <g transform="translate(-30 76) scale(0.8)">
        <SittingCat
          patches={SIT_PATCHES}
          chest
          paws="pair"
          breathe
          head={{
            x: 206,
            y: 144,
            rotate: 10,
            mouth: 'flat',
            // Puzzled: the head tilts a little further, then back.
            loop: {
              animate: { rotate: [0, 5, 0] },
              transition: loop(3.2, { repeatDelay: 0.6 }),
            },
            eyes: { kind: 'open', pupil: [-29, -2, 8], glint: [-32, -6, 3] },
          }}
        />
      </g>
      <path d="M252 274L240 250H384L372 274Z" fill={C.boxLight} {...box} />
      <rect
        x={252}
        y={274}
        width={120}
        height={98}
        rx={4}
        fill={C.box}
        {...box}
      />
      <rect
        x={266}
        y={288}
        width={92}
        height={70}
        rx={3}
        fill={C.boxInside}
        stroke={C.ink}
        strokeWidth={3}
      />
      <path
        d="M342 289Q344 304 357 306M328 289Q334 318 357 322M357 289L335 314"
        fill="none"
        stroke={C.boxGrain}
        strokeWidth={1.5}
      />
      <Move
        origin={[312, 244]}
        animate={{ y: [0, -5, 0], rotate: [0, -6, 0] }}
        transition={loop(2)}
      >
        <path
          d="M298 208C298 190 326 190 326 208C326 220 312 220 312 232"
          fill="none"
          stroke={C.ink}
          strokeWidth={7}
        />
        <path d="M312 244V245" fill="none" stroke={C.ink} strokeWidth={8} />
      </Move>
    </>
  );
}
