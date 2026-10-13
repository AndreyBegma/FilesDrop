'use client';

import { motion, useAnimationControls } from 'motion/react';
import type { ReactNode } from 'react';
import { loop, Move, POP, pivot, useCatMotion } from '../motion';
import { C } from '../palette';
import { useEvery } from '../use-every';
import { Limb, Paw } from './body';

/** A sheet of paper: the file the cat handles. */
export function Paper({
  x,
  y,
  width,
  height,
  rx = 6,
  lines,
  lineWidth = 4,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  lines: string;
  lineWidth?: number;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill={C.fur}
        stroke={C.ink}
        strokeWidth={4}
      />
      <path
        d={lines}
        fill="none"
        stroke={C.periwinkle}
        strokeWidth={lineWidth}
      />
    </>
  );
}

/** A round status badge that pops in when the pose appears. */
export function Badge({
  cx,
  cy,
  r,
  fill,
  children,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  children: ReactNode;
}) {
  return (
    <Move
      origin={[cx, cy]}
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ ...POP, delay: 0.15 }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={C.ink}
        strokeWidth={4}
      />
      {children}
    </Move>
  );
}

/** A four-point star that twinkles. */
export function Sparkle({
  d,
  center,
  delay,
}: {
  d: string;
  center: readonly [number, number];
  delay: number;
}) {
  return (
    <Move
      origin={center}
      animate={{ scale: [1, 0.55, 1.12, 1], rotate: [0, 20, -6, 0] }}
      transition={loop(1.6, { delay, repeatDelay: 0.6 })}
    >
      <path d={d} fill={C.folder} stroke={C.ink} strokeWidth={3} />
    </Move>
  );
}

const SHACKLE = 'M184 284V266A16 16 0 0 1 216 266V284';
/** A short highlight riding the shackle's top-left curve (r 16 around 200,266). */
const SHACKLE_GLINT = 'M186.1 258A16 16 0 0 1 193.2 251.5';
const SHACKLE_BASE = [200, 284] as const;

/**
 * The padlock on the box front (locked.svg, wrong-password.svg). With
 * `shine`, every ~5 s the shackle gives a tiny wiggle and a glint runs along
 * it; at rest it is exactly the artwork.
 */
export function Padlock({ shine = false }: { shine?: boolean }) {
  const { animated } = useCatMotion();
  const shackle = useAnimationControls();
  const glint = useAnimationControls();
  const live = animated && shine;
  useEvery(
    () => {
      void shackle.start({
        rotate: [0, -5, 3.5, -1.5, 0],
        transition: { duration: 0.6, ease: 'easeInOut' },
      });
      void glint.start({
        opacity: [0, 1, 0],
        transition: { duration: 0.6, ease: 'easeOut' },
      });
    },
    4500,
    5500,
    live,
  );

  const rings = (
    <>
      <path d={SHACKLE} fill="none" stroke={C.ink} strokeWidth={12} />
      <path d={SHACKLE} fill="none" stroke={C.folder} strokeWidth={6} />
    </>
  );
  return (
    <>
      {live ? (
        <motion.g style={pivot(SHACKLE_BASE)} animate={shackle}>
          {rings}
          <motion.path
            d={SHACKLE_GLINT}
            fill="none"
            stroke={C.fur}
            strokeWidth={2.5}
            initial={{ opacity: 0 }}
            animate={glint}
          />
        </motion.g>
      ) : (
        rings
      )}
      <rect
        x={170}
        y={280}
        width={60}
        height={48}
        rx={8}
        fill={C.folder}
        stroke={C.ink}
        strokeWidth={4}
      />
      <circle cx={200} cy={300} r={6} fill={C.ink} />
      <path d="M200 302V314" fill="none" stroke={C.ink} strokeWidth={6} />
    </>
  );
}

const HUG_LEFT = 'M140 222C96 238 90 280 114 300';
const HUG_RIGHT = 'M260 222C304 238 310 280 286 300';

/**
 * The locked box: lid, box, padlock, and both front legs hugging it, in the
 * artboards' draw order (locked.svg, wrong-password.svg).
 */
export function GuardedBox({ shine = false }: { shine?: boolean }) {
  const box = { stroke: C.ink, strokeWidth: 4 } as const;
  return (
    <>
      <path d="M100 250L120 228H280L300 250Z" fill={C.boxDark} {...box} />
      <rect
        x={100}
        y={250}
        width={200}
        height={110}
        rx={5}
        fill={C.box}
        {...box}
      />
      <Padlock shine={shine} />
      <Limb d={HUG_LEFT} outer={26} inner={18} />
      <Paw cx={120} cy={306} rx={19} ry={13} toes="M114 302V311M126 302V311" />
      <Limb d={HUG_RIGHT} outer={26} inner={18} />
      <Paw cx={280} cy={306} rx={19} ry={13} toes="M274 302V311M286 302V311" />
    </>
  );
}
