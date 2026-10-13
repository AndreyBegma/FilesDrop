'use client';

import { BREATH, loop, Move } from '../motion';
import { C } from '../palette';
import { Body, Breathe, Shadow, Tail } from '../parts/body';
import { Head } from '../parts/head';

/** The Z's, smallest first, as drawn on idle.svg. */
const ZS = [
  { d: 'M226 168H240L226 184H240', opacity: 0.55, width: 4 },
  { d: 'M258 126H278L258 150H278', opacity: 0.75, width: 5 },
  { d: 'M298 70H326L298 104H326', opacity: 1, width: 6 },
] as const;

/**
 * idle.svg: curled up asleep. The artboard's little progress bar is not
 * drawn (docs/mascot/README.md).
 */
export function IdlePose() {
  return (
    <>
      <Shadow cx={208} cy={352} rx={136} ry={9} />
      <Breathe base={[214, 346]}>
        <Body
          shape={{ ellipse: [214, 282, 124, 64] }}
          patches={[
            [292, 258, 58, 40],
            [196, 232, 34, 20],
          ]}
        />
        <Tail d="M330 304C344 352 236 360 176 344" width={24} />
      </Breathe>
      <Move animate={{ y: [0, -2, 0] }} transition={BREATH}>
        <Head
          x={132}
          y={276}
          rotate={-6}
          scale={0.82}
          eyes={{
            kind: 'closed',
            d: 'M-47 -8Q-34 4-21 -8M21 -8Q34 4 47 -8',
          }}
        />
      </Move>
      {ZS.map((z, i) => (
        // Each Z rises and drifts right, fading in and out, one after another.
        <Move
          key={z.d}
          animate={{ x: [-6, 0, 6], y: [10, 0, -12], opacity: [0, 1, 0] }}
          transition={loop(3.6, { ease: 'easeOut', delay: i * 1.2 })}
        >
          <path
            d={z.d}
            fill="none"
            stroke={C.ink}
            opacity={z.opacity}
            strokeWidth={z.width}
          />
        </Move>
      ))}
    </>
  );
}
