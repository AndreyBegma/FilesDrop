'use client';

import type { ReactNode } from 'react';
import { loop, Move, POP } from '../motion';
import { C } from '../palette';

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
