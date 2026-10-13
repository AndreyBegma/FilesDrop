'use client';

import { SIT_PATCHES, SittingCat } from '../parts/body';

/** main.svg: sitting, looking at the viewer. */
export function MainPose() {
  return (
    <SittingCat
      patches={SIT_PATCHES}
      chest
      paws="pair"
      breathe
      head={{
        x: 200,
        y: 140,
        eyes: { kind: 'open', pupil: [-34, -6, 9], glint: [-37, -10, 3] },
      }}
    />
  );
}
