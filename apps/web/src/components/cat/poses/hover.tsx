'use client';

import { loop, Move } from '../motion';
import { C } from '../palette';
import { Paw, Shadow } from '../parts/body';
import { Head } from '../parts/head';
import { CAT_POSE_TRAITS } from '../poses';

/** hover.svg: peeking over a card, paws on its edge. */
export function HoverPose() {
  return (
    <>
      <Shadow cx={200} cy={362} rx={140} ry={9} />
      <Head
        x={200}
        y={160}
        rotate={-5}
        tilt={CAT_POSE_TRAITS.hover.tilt}
        whiskers="none"
        nose="none"
        mouth="none"
        eyes={{
          kind: 'open',
          irisY: -10,
          pupil: [-34, -6, 10],
          glint: [-37, -11, 3],
        }}
      />
      <rect
        x={56}
        y={172}
        width={288}
        height={176}
        rx={18}
        fill={C.fur}
        stroke={C.ink}
        strokeWidth={4}
      />
      <circle cx={90} cy={214} r={10} fill={C.mist} />
      <rect x={110} y={207} width={120} height={14} rx={7} fill={C.mist} />
      <rect
        x={80}
        y={242}
        width={240}
        height={84}
        rx={12}
        fill={C.paper}
        stroke={C.periwinkle}
        strokeWidth={3}
        strokeDasharray="8 8"
      />
      <Move animate={{ y: [0, -5, 0] }} transition={loop(1.4)}>
        <path
          d="M200 300V270M187 283L200 270L213 283"
          fill="none"
          stroke={C.yarn}
          strokeWidth={6}
        />
      </Move>
      <Paw cx={128} cy={172} rx={20} ry={12} toes="M122 170V178M134 170V178" />
      <Paw cx={272} cy={172} rx={20} ry={12} toes="M266 170V178M278 170V178" />
    </>
  );
}
