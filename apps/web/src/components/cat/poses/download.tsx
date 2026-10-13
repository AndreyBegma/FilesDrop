'use client';

import { loop, Move } from '../motion';
import { C } from '../palette';
import { Paw, Shadow } from '../parts/body';
import { Head } from '../parts/head';
import { Paper } from '../parts/props';

const box = { stroke: C.ink, strokeWidth: 4 } as const;

/** download.svg: peeking out of a box, holding up a file. */
export function DownloadPose() {
  return (
    <>
      <Shadow cx={200} cy={372} rx={136} ry={10} />
      <path d="M90 232L62 214L80 196L112 208Z" fill={C.box} {...box} />
      <path d="M310 232L338 214L320 196L288 208Z" fill={C.box} {...box} />
      <path d="M90 232L112 208H288L310 232Z" fill={C.boxDark} {...box} />
      <Move animate={{ y: [0, -4, 0] }} transition={loop(3.2)}>
        <Head
          x={176}
          y={168}
          eyes={{ kind: 'open', pupil: [-34, -6, 10], glint: [-37, -10, 3] }}
        />
      </Move>
      <Move
        origin={[283, 232]}
        animate={{ rotate: [0, 3, 0, -2, 0] }}
        transition={loop(2.6)}
      >
        <g transform="rotate(8 283 196)">
          <Paper
            x={256}
            y={160}
            width={54}
            height={72}
            lines="M267 178H299M267 191H299M267 204H287"
          />
        </g>
      </Move>
      <rect
        x={90}
        y={232}
        width={220}
        height={132}
        rx={6}
        fill={C.box}
        {...box}
      />
      <Move animate={{ y: [0, 5, 0] }} transition={loop(1.4)}>
        <path
          d="M200 274V324M180 304L200 324L220 304"
          fill="none"
          stroke={C.boxDark}
          strokeWidth={9}
        />
      </Move>
      <Paw cx={122} cy={232} rx={20} ry={12} toes="M116 230V238M128 230V238" />
      <Paw cx={264} cy={232} rx={20} ry={12} toes="M258 230V238M270 230V238" />
    </>
  );
}
