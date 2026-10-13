'use client';

import { loop, Move } from '../motion';
import { C } from '../palette';
import { Shadow, SIT_PATCHES, SittingCat } from '../parts/body';

const folder = { stroke: C.ink, strokeWidth: 4 } as const;

/** empty.svg: sitting next to an empty folder. */
export function EmptyPose() {
  return (
    <>
      <Shadow cx={308} cy={374} rx={74} ry={8} />
      <g transform="translate(-30 76) scale(0.8)">
        <SittingCat
          patches={SIT_PATCHES}
          chest
          paws="pair"
          breathe
          head={{
            x: 200,
            y: 140,
            eyes: { kind: 'open', pupil: [-29, -2, 9], glint: [-32, -6, 3] },
          }}
        />
      </g>
      {/* The ghost of a file that is not there. */}
      <Move
        animate={{ opacity: [1, 0.35, 1], y: [0, -4, 0] }}
        transition={loop(2.8)}
      >
        <rect
          x={286}
          y={190}
          width={44}
          height={56}
          rx={6}
          fill="none"
          stroke={C.slate}
          strokeWidth={3}
          strokeDasharray="6 7"
        />
      </Move>
      <path
        d="M250 264H288L298 276H360C364 276 366 278 366 282V356H250Z"
        fill={C.folderDark}
        {...folder}
      />
      <path d="M238 298H378L366 362H250Z" fill={C.folder} {...folder} />
    </>
  );
}
