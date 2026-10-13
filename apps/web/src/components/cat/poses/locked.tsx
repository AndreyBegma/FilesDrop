'use client';

import {
  Body,
  Breathe,
  type Patch,
  Shadow,
  SIT_TAIL,
  Tail,
} from '../parts/body';
import { Head } from '../parts/head';
import { GuardedBox } from '../parts/props';

/** The sitting patches without the small one: the box hides that side. */
export const GUARD_PATCHES = [
  [122, 282, 36, 52],
  [284, 296, 32, 50],
] as const satisfies readonly Patch[];

/**
 * locked.svg: on guard, hugging a box with a padlock, serious brows.
 * Calm breathing, a slow blink now and then, a glint on the shackle.
 */
export function LockedPose() {
  return (
    <>
      <Shadow cx={200} cy={378} rx={130} ry={10} />
      <Breathe base={[200, 350]} depth={1.02}>
        <Body patches={GUARD_PATCHES} />
      </Breathe>
      <Tail d={SIT_TAIL} />
      <Head
        x={200}
        y={140}
        bob={3}
        blink="slow"
        brows="stern"
        mouth="stern"
        eyes={{ kind: 'open', pupil: [-34, -3, 9], glint: [-37, -6, 3] }}
      />
      <GuardedBox shine />
    </>
  );
}
