'use client';

import { Move } from '../motion';
import { C } from '../palette';
import { Limb, Paw, Shadow, Toes } from '../parts/body';
import { Head } from '../parts/head';

const ink = { fill: 'none', stroke: C.ink } as const;

/** loading.svg: curled into a ring, chasing its tail. The ring spins. */
export function LoadingPose() {
  return (
    <>
      <Shadow cx={200} cy={364} rx={120} ry={9} />
      <Move
        origin={[200, 210]}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1.6,
          ease: 'linear',
          repeat: Number.POSITIVE_INFINITY,
        }}
      >
        <path
          d="M150 97A124 124 0 0 1 250 97"
          {...ink}
          opacity={0.4}
          strokeWidth={4}
          strokeDasharray="2 12"
        />
        <Paw cx={266} cy={326} rx={15} ry={10} />
        <Paw cx={150} cy={330} rx={15} ry={10} />
        <path d="M290 210A90 90 0 0 0 231 125" {...ink} strokeWidth={22} />
        <path d="M290 210A90 90 0 0 1 110 210" {...ink} strokeWidth={76} />
        <path
          d="M290 210A90 90 0 0 1 110 210"
          fill="none"
          stroke={C.fur}
          strokeWidth={68}
        />
        <path
          d="M285 241A90 90 0 0 1 245 288"
          {...ink}
          strokeWidth={68}
          strokeLinecap="butt"
        />
        <path
          d="M169 295A90 90 0 0 1 131 268"
          {...ink}
          strokeWidth={68}
          strokeLinecap="butt"
        />
        <Limb d="M120 170C124 146 138 128 160 118" outer={24} inner={17} />
        <Toes d="M158 112V123" />
        <Head
          x={108}
          y={208}
          rotate={-18}
          scale={0.75}
          eyes={{ kind: 'open', pupil: [-29, -10, 9], glint: [-32, -14, 3] }}
        />
      </Move>
    </>
  );
}
