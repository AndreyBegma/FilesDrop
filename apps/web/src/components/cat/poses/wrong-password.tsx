'use client';

import { Move } from '../motion';
import { C } from '../palette';
import { Body, Breathe, Shadow, SIT_TAIL, Tail } from '../parts/body';
import { Head } from '../parts/head';
import { Badge, GuardedBox } from '../parts/props';
import { GUARD_PATCHES } from './locked';

/**
 * The head starts swung 20° the other way and springs back to the
 * artboard's 10° tilt, overshooting left-right a few times (~0.6 s).
 */
const SHAKE = {
  initial: { rotate: -20 },
  animate: { rotate: 0 },
  transition: { type: 'spring', stiffness: 520, damping: 9 },
} as const;

/** The motion arcs flare with each swing and end at the artboard's look. */
const ARCS_FLARE = {
  opacity: [0, 1, 0.25, 1, 0.4, 1, 0.7, 1],
  transition: {
    duration: 0.6,
    times: [0, 0.1, 0.22, 0.34, 0.46, 0.6, 0.78, 1],
  },
};

/** wrong-password.svg: shaking its head at the locked box, red cross badge. */
export function WrongPasswordPose() {
  return (
    <>
      <Shadow cx={200} cy={378} rx={130} ry={10} />
      <Breathe base={[200, 350]} depth={1.02}>
        <Body patches={GUARD_PATCHES} />
      </Breathe>
      <Tail d={SIT_TAIL} />
      <Move initial={{ opacity: 0 }} animate={ARCS_FLARE}>
        <path
          d="M106 108C94 128 94 154 106 174M294 108C306 128 306 154 294 174"
          fill="none"
          stroke={C.ink}
          opacity={0.55}
          strokeWidth={4}
        />
      </Move>
      <Head
        x={200}
        y={142}
        rotate={10}
        bob={3}
        mouth="wobble"
        loop={SHAKE}
        eyes={{ kind: 'open', pupil: [-34, -6, 9], glint: [-37, -10, 3] }}
      />
      <GuardedBox />
      <Badge cx={242} cy={262} r={22} fill={C.danger}>
        <path
          d="M234 254L250 270M250 254L234 270"
          fill="none"
          stroke={C.fur}
          strokeWidth={5}
        />
      </Badge>
    </>
  );
}
