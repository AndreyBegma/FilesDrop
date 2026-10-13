'use client';

import { type ReactNode, useId } from 'react';
import { BREATH, Move } from '../motion';
import { C } from '../palette';
import { Head, type HeadProps } from './head';

type Point = readonly [x: number, y: number];
export type Patch = readonly [cx: number, cy: number, rx: number, ry: number];

/** The sitting body outline shared by most artboards. */
export const SIT_BODY =
  'M150 196C118 228 94 292 110 334C118 356 282 356 290 334C306 292 282 228 250 196Z';
/** The sitting tail. */
export const SIT_TAIL = 'M288 326C322 372 196 376 128 356';

/** The usual patches of the sitting cat. */
export const SIT_PATCHES = [
  [122, 282, 36, 52],
  [284, 296, 32, 50],
  [234, 290, 14, 17],
] as const satisfies readonly Patch[];

const ink = { fill: 'none', stroke: C.ink } as const;

/** `useId` output made safe for `url(#…)`. */
export function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export function Shadow({
  cx,
  cy,
  rx,
  ry,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={C.ink} opacity={0.1} />;
}

type BodyShape =
  | { d: string }
  | { ellipse: readonly [cx: number, cy: number, rx: number, ry: number] };

function Shape({
  shape,
  ...paint
}: {
  shape: BodyShape;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  if ('d' in shape) return <path d={shape.d} {...paint} />;
  const [cx, cy, rx, ry] = shape.ellipse;
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...paint} />;
}

/**
 * Body fill, the black patches clipped to it, and the outline.
 * `chest` adds the line between the front legs.
 */
export function Body({
  shape = { d: SIT_BODY },
  patches,
  chest = false,
}: {
  shape?: BodyShape;
  patches: readonly Patch[];
  chest?: boolean;
}) {
  const clipId = useSvgId('fd-body-');
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <Shape shape={shape} fill={C.ink} />
        </clipPath>
      </defs>
      <Shape shape={shape} fill={C.fur} />
      <g clipPath={`url(#${clipId})`} fill={C.ink}>
        {patches.map(([cx, cy, rx, ry]) => (
          <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={rx} ry={ry} />
        ))}
      </g>
      <Shape shape={shape} fill="none" stroke={C.ink} strokeWidth={4} />
      {chest && <path d="M200 262V330" {...ink} strokeWidth={3} />}
    </>
  );
}

/** Breathing: scaleY 1 → `depth` around the point the body rests on. */
export function Breathe({
  base,
  depth = 1.03,
  children,
}: {
  base: Point;
  depth?: number;
  children: ReactNode;
}) {
  return (
    <Move origin={base} animate={{ scaleY: [1, depth, 1] }} transition={BREATH}>
      {children}
    </Move>
  );
}

export function Paw({
  cx,
  cy,
  rx = 21,
  ry = 13,
  toes,
}: {
  cx: number;
  cy: number;
  rx?: number;
  ry?: number;
  toes?: string;
}) {
  return (
    <>
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={C.fur}
        stroke={C.ink}
        strokeWidth={4}
      />
      {toes && <path d={toes} {...ink} strokeWidth={2} />}
    </>
  );
}

/** Toe lines, drawn the way the artboards draw them. */
export function Toes({ d }: { d: string }) {
  return <path d={d} {...ink} strokeWidth={2} />;
}

/** Tail stroke; it sways around its root (the path's first point). */
export function Tail({
  d,
  width = 26,
  sway = true,
}: {
  d: string;
  width?: number;
  sway?: boolean;
}) {
  const root = d.match(/^M(-?[\d.]+)[ ,](-?[\d.]+)/);
  const origin: Point = root ? [Number(root[1]), Number(root[2])] : [0, 0];
  const path = <path d={d} {...ink} strokeWidth={width} />;
  if (!sway) return path;
  return (
    <Move
      origin={origin}
      animate={{ rotate: [0, -2.5, 0, 1.5, 0] }}
      transition={{
        duration: 3.6,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'easeInOut',
        repeatDelay: 0.8,
      }}
    >
      {path}
    </Move>
  );
}

/** A leg drawn as a stroke: ink outline, white fill stroke on top. */
export function Limb({
  d,
  outer,
  inner,
}: {
  d: string;
  outer: number;
  inner: number;
}) {
  return (
    <>
      <path d={d} {...ink} strokeWidth={outer} />
      <path d={d} fill="none" stroke={C.fur} strokeWidth={inner} />
    </>
  );
}

const PAWS_PAIR_TOES = 'M174 337V345M186 337V345M215 337V345M227 337V345';
const PAW_SINGLE_TOES = 'M184 337V345M196 337V345';

export interface SittingCatProps {
  patches: readonly Patch[];
  chest?: boolean;
  /** Front paws on the ground: both, the left one only, or none. */
  paws?: 'pair' | 'single' | 'none';
  shadow?: boolean;
  tail?: string;
  head: HeadProps;
  /** Drawn after the tail, before the head (raised arms, a cable). */
  beforeHead?: ReactNode;
  /** Breathe (body rises, head bobs). Off when limbs attach to the body. */
  breathe?: boolean;
}

/**
 * The sitting cat, in the artboards' draw order:
 * shadow, body, chest line, paws, tail, extras, head.
 */
export function SittingCat({
  patches,
  chest = false,
  paws = 'none',
  shadow = true,
  tail = SIT_TAIL,
  head,
  beforeHead,
  breathe = false,
}: SittingCatProps) {
  const body = <Body patches={patches} chest={chest} />;
  return (
    <>
      {shadow && <Shadow cx={200} cy={378} rx={130} ry={10} />}
      {breathe ? (
        <Breathe base={[200, 350]} depth={1.02}>
          {body}
        </Breathe>
      ) : (
        body
      )}
      {paws === 'pair' && (
        <>
          <Paw cx={180} cy={340} />
          <Paw cx={221} cy={340} />
          <Toes d={PAWS_PAIR_TOES} />
        </>
      )}
      {paws === 'single' && <Paw cx={190} cy={340} toes={PAW_SINGLE_TOES} />}
      <Tail d={tail} />
      {beforeHead}
      <Head bob={breathe ? 3 : 0} {...head} />
    </>
  );
}
