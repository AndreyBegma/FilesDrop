'use client';

import { Move } from '../motion';
import { C } from '../palette';
import { SIT_PATCHES, SittingCat } from '../parts/body';
import { Badge } from '../parts/props';

/** error.svg: sad brows, a tear, red cross. Shakes once on arrival. */
export function ErrorPose() {
  return (
    <>
      <Move
        animate={{ x: [0, -8, 7, -5, 3, 0] }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <SittingCat
          patches={SIT_PATCHES}
          chest
          paws="pair"
          breathe
          head={{
            x: 200,
            y: 148,
            whiskers: 'droop',
            brows: 'sad',
            mouth: 'sad',
            eyes: {
              kind: 'open',
              pupil: [-34, -2, 10],
              glint: [-31, -5, 3],
            },
          }}
        />
      </Move>
      <Badge cx={316} cy={92} r={30} fill={C.danger}>
        <path
          d="M305 81L327 103M327 81L305 103"
          fill="none"
          stroke={C.fur}
          strokeWidth={7}
        />
      </Badge>
    </>
  );
}
