'use client';

import { loop, Move } from '../motion';
import { C } from '../palette';
import { Limb, Shadow, SittingCat, Toes } from '../parts/body';
import { Badge, Paper } from '../parts/props';

const box = { stroke: C.ink, strokeWidth: 4 } as const;
/** Strain: push, ease off, push again. Every part shares this rhythm. */
const STRAIN = loop(0.7, { repeatDelay: 0.25 });

/** too-big.svg: straining to push a huge file into a small box. */
export function TooBigPose() {
  return (
    <>
      <Shadow cx={330} cy={377} rx={56} ry={7} />
      <Move animate={{ x: [0, 4, 0] }} transition={STRAIN}>
        <g transform="translate(-36 76) scale(0.8)">
          <SittingCat
            patches={[
              [122, 282, 36, 52],
              [284, 306, 32, 40],
            ]}
            head={{
              x: 200,
              y: 140,
              mouth: 'strain',
              eyes: {
                kind: 'closed',
                d: 'M-46 -15L-24 -6L-46 3M46 -15L24 -6L46 3',
              },
            }}
          />
        </g>
      </Move>
      <Move
        animate={{ y: [0, 4, 0], opacity: [1, 0.7, 1] }}
        transition={loop(1.4)}
      >
        <path
          d="M66 118C59 130 61 139 66 139C71 139 73 130 66 118Z"
          fill={C.tear}
          stroke={C.ink}
          strokeWidth={2}
        />
      </Move>
      <path d="M296 320L308 306H364L376 320Z" fill={C.boxDark} {...box} />
      <Move
        origin={[290, 228]}
        animate={{ x: [0, 3, 0], rotate: [0, 1.5, 0] }}
        transition={STRAIN}
      >
        <g transform="rotate(8 290 228)">
          <Paper
            x={234}
            y={150}
            width={112}
            height={156}
            rx={8}
            lines="M252 180H328M252 202H328M252 224H328M252 246H328M252 268H300"
            lineWidth={5}
          />
        </g>
      </Move>
      <rect
        x={296}
        y={320}
        width={80}
        height={52}
        rx={4}
        fill={C.box}
        {...box}
      />
      <Move animate={{ x: [0, 4, 0] }} transition={STRAIN}>
        <Limb d="M150 258C172 244 196 238 222 238" outer={24} inner={17} />
        <Limb d="M150 284C174 278 198 274 226 274" outer={24} inner={17} />
        <Toes d="M224 233V243M228 269V279" />
      </Move>
      <Badge cx={350} cy={140} r={24} fill={C.danger}>
        <path d="M350 127V143" fill="none" stroke={C.fur} strokeWidth={6} />
        <path d="M350 152V153" fill="none" stroke={C.fur} strokeWidth={7} />
      </Badge>
    </>
  );
}
