'use client';

import { loop, Move } from '../motion';
import { C } from '../palette';
import { SIT_PATCHES, SittingCat } from '../parts/body';
import { Badge } from '../parts/props';

const CABLE =
  'M40 366C90 330 150 300 200 308C262 318 322 304 302 270C286 244 108 268 100 236C94 210 250 222 318 196';

/** offline.svg: tangled in a cable, no-wifi badge. */
export function OfflinePose() {
  return (
    <>
      <SittingCat
        patches={SIT_PATCHES}
        chest
        paws="pair"
        breathe
        beforeHead={
          <>
            <path d={CABLE} fill="none" stroke={C.ink} strokeWidth={10} />
            <path d={CABLE} fill="none" stroke={C.yarn} strokeWidth={5} />
            <g transform="translate(318 196) rotate(70)">
              {/* The loose plug dangles from the end of the cable. */}
              <Move
                animate={{ rotate: [0, -10, 0, 6, 0] }}
                transition={loop(3, { repeatDelay: 0.4 })}
              >
                <path
                  d="M-5 -26V-40M5 -26V-40"
                  fill="none"
                  stroke={C.ink}
                  strokeWidth={4}
                />
                <rect
                  x={-11}
                  y={-28}
                  width={22}
                  height={30}
                  rx={5}
                  fill={C.yarn}
                  stroke={C.ink}
                  strokeWidth={4}
                />
              </Move>
            </g>
          </>
        }
        head={{
          x: 200,
          y: 140,
          mouth: 'wavy',
          eyes: { kind: 'open', pupil: [-30, -11, 5] },
        }}
      />
      <Badge cx={322} cy={84} r={30} fill={C.signal}>
        <path
          d="M304 80A25 25 0 0 1 340 80M311 90A15 15 0 0 1 333 90"
          fill="none"
          stroke={C.fur}
          strokeWidth={5}
        />
        <path d="M322 100V101" fill="none" stroke={C.fur} strokeWidth={7} />
        <path d="M304 102L340 66" fill="none" stroke={C.ink} strokeWidth={9} />
        <path d="M304 102L340 66" fill="none" stroke={C.fur} strokeWidth={4} />
      </Badge>
    </>
  );
}
