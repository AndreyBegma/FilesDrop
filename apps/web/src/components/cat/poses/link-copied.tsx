'use client';

import { C } from '../palette';
import { SIT_PATCHES, SittingCat } from '../parts/body';
import { Badge } from '../parts/props';

/** link-copied.svg: the link chain in its teeth, green check. */
export function LinkCopiedPose() {
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
          mouth: 'chain',
          eyes: { kind: 'open', pupil: [-34, -6, 9], glint: [-37, -10, 3] },
        }}
      />
      <Badge cx={316} cy={92} r={24} fill={C.ok}>
        <path
          d="M305 92L313 100L328 84"
          fill="none"
          stroke={C.fur}
          strokeWidth={6}
        />
      </Badge>
    </>
  );
}
