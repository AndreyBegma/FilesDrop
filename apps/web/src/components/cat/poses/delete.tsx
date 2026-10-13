'use client';

import { Move } from '../motion';
import { C } from '../palette';
import { Limb, Shadow, SittingCat, Toes } from '../parts/body';
import { Paper } from '../parts/props';

const edge = { stroke: C.ink, strokeWidth: 4 } as const;
const SWIPE = { type: 'spring', stiffness: 220, damping: 14 } as const;

/**
 * delete.svg: sitting on a table, swiping a file off into a bin.
 * On arrival the paw swipes and the file flies to where the artboard has it.
 */
export function DeletePose() {
  return (
    <>
      <Shadow cx={326} cy={388} rx={50} ry={6} />
      <rect x={36} y={318} width={14} height={82} fill={C.mist} {...edge} />
      <rect x={222} y={318} width={14} height={82} fill={C.mist} {...edge} />
      <rect
        x={-10}
        y={300}
        width={280}
        height={18}
        rx={4}
        fill={C.fur}
        {...edge}
      />
      <g transform="translate(-24 53) scale(0.7)">
        <SittingCat
          shadow={false}
          patches={[
            [122, 282, 36, 52],
            [284, 300, 32, 46],
          ]}
          paws="single"
          tail="M286 330C310 366 200 366 130 352"
          head={{
            x: 200,
            y: 140,
            brows: 'flat',
            mouth: 'smirk',
            eyes: { kind: 'open', pupil: [-28, -2, 8] },
          }}
        />
      </g>
      <Move
        origin={[150, 232]}
        initial={{ rotate: -22 }}
        animate={{ rotate: 0 }}
        transition={SWIPE}
      >
        <Limb d="M150 232C182 228 216 240 250 262" outer={22} inner={15} />
        <Toes d="M254 258L248 267" />
      </Move>
      <Move
        origin={[306, 258]}
        initial={{ x: -46, y: -14, rotate: -28 }}
        animate={{ x: 0, y: 0, rotate: 0 }}
        transition={{ ...SWIPE, delay: 0.08 }}
      >
        <g transform="rotate(28 306 258)">
          <Paper
            x={284}
            y={229}
            width={44}
            height={58}
            lines="M293 244H319M293 255H319M293 266H309"
          />
        </g>
      </Move>
      <Move
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        <path
          d="M286 212L280 200M304 204L302 190M324 208L330 196"
          fill="none"
          stroke={C.ink}
          opacity={0.45}
          strokeWidth={3}
        />
      </Move>
      <path d="M294 336H358L351 386H301Z" fill={C.mist} {...edge} />
      <path
        d="M314 348V374M326 348V374M338 348V374"
        fill="none"
        stroke={C.slate}
        strokeWidth={3}
      />
      <rect
        x={286}
        y={324}
        width={80}
        height={12}
        rx={4}
        fill={C.mist}
        {...edge}
      />
    </>
  );
}
