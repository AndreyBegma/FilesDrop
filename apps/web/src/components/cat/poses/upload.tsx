'use client';

import { loop, Move } from '../motion';
import { C } from '../palette';
import { Limb, Shadow, SittingCat, Toes } from '../parts/body';
import { Paper } from '../parts/props';

const box = { stroke: C.ink, strokeWidth: 4 } as const;
const PUSH = loop(1.2);

/** upload.svg: pushing a file into a box. */
export function UploadPose() {
  return (
    <>
      <Shadow cx={318} cy={377} rx={68} ry={8} />
      <g transform="translate(-6 76) scale(0.8)">
        <SittingCat
          patches={[
            [122, 282, 36, 52],
            [284, 296, 32, 50],
          ]}
          paws="single"
          head={{
            x: 200,
            y: 140,
            eyes: { kind: 'open', pupil: [-29, -3, 9], glint: [-32, -7, 3] },
          }}
        />
      </g>
      <path d="M262 300L278 282H358L374 300Z" fill={C.boxDark} {...box} />
      <Move animate={{ y: [0, 5, 0] }} transition={PUSH}>
        <g transform="rotate(10 319 259)">
          <Paper
            x={294}
            y={226}
            width={50}
            height={66}
            lines="M304 242H334M304 254H334M304 266H324"
          />
        </g>
      </Move>
      <rect
        x={262}
        y={300}
        width={112}
        height={72}
        rx={4}
        fill={C.box}
        {...box}
      />
      <path
        d="M318 354V324M306 336L318 324L330 336"
        fill="none"
        stroke={C.boxDark}
        strokeWidth={7}
      />
      <path d="M262 300L244 284L260 270L278 282Z" fill={C.box} {...box} />
      <path d="M374 300L392 284L376 270L358 282Z" fill={C.box} {...box} />
      <Move
        origin={[196, 262]}
        animate={{ rotate: [0, 3, 0] }}
        transition={PUSH}
      >
        <Limb d="M196 262C226 246 256 246 286 254" outer={24} inner={17} />
        <Toes d="M288 249V259" />
      </Move>
      <Move animate={{ opacity: [1, 0.2, 1] }} transition={loop(1.2)}>
        <path
          d="M356 216L366 206M362 234L376 230"
          fill="none"
          stroke={C.ink}
          opacity={0.5}
          strokeWidth={3}
        />
      </Move>
    </>
  );
}
