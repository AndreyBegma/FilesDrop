'use client';

import {
  motion,
  type TargetAndTransition,
  type Transition,
  useAnimationControls,
  useTransform,
  type Variants,
} from 'motion/react';
import type { ReactNode } from 'react';
import { BREATH, Move, pivot, useCatMotion } from '../motion';
import { C } from '../palette';
import { useEvery } from '../use-every';

/* Shared head geometry, local to the head group (docs/mascot/README.md). */
const EAR_L = 'M-66 -28C-74 -60-52 -74-30 -58Z';
const EAR_R = 'M66 -28C74 -60 52 -74 30 -58Z';
const MASK =
  'M-73 4C-76 -40-40 -64 0 -64C40 -64 76 -40 73 4C66 30 34 30 18 6C12 -14 6 -36 0 -46C-6 -36-12 -14-18 6C-34 30-66 30-73 4Z';
const FOLD = 'M-62 -48C-52 -56-44 -58-36 -55M62 -48C52 -56 44 -58 36 -55';

const WHISKERS = {
  default: 'M-26 22L-96 12M-26 28L-94 34M26 22L96 12M26 28L94 34',
  droop: 'M-26 24L-94 26M-26 30L-90 46M26 24L94 26M26 30L90 46',
} as const;

const NOSES = {
  default: 'M-6 14H6L0 21Z',
  big: 'M-7 14H7L0 22Z',
} as const;

const BROWS = {
  sad: ['M-52 -24H-16V-18L-52 -4Z', 'M52 -24H16V-18L52 -4Z'],
  flat: ['M-52 -24H-16V-8H-52Z', 'M52 -24H16V-8H52Z'],
  /** locked: thin, level, serious. */
  stern: ['M-52 -24H-16V-11H-52Z', 'M16 -24H52V-11H16Z'],
} as const;

/** Where the left eye sits; the right one is always 68 units to the right. */
const EYE_X = -34;
const EYE_GAP = 68;
/** README: pupils move within the iris by at most 5 px. */
const PUPIL_REACH = 5;

type Circle = readonly [cx: number, cy: number, r: number];

export type EyesSpec =
  | {
      kind: 'open';
      /** Iris centre y (default -6) and radius (default 15). */
      irisY?: number;
      irisR?: number;
      /** Left pupil; the right one mirrors it 68 units to the right. */
      pupil: Circle;
      /** Left highlight, if the artboard draws one. */
      glint?: Circle;
    }
  | {
      kind: 'closed';
      /** Both closed-eye strokes, as drawn on the artboard. */
      d: string;
    };

export type MouthKind =
  | 'smile'
  | 'smile-big'
  | 'open'
  | 'grin'
  | 'chain'
  | 'sad'
  | 'strain'
  | 'flat'
  | 'smirk'
  | 'wavy'
  | 'stern'
  | 'wobble';

export interface HeadProps {
  /** Head group placement on the artboard: translate, then rotate, then scale. */
  x: number;
  y: number;
  rotate?: number;
  scale?: number;
  eyes: EyesSpec;
  whiskers?: keyof typeof WHISKERS | 'none';
  brows?: keyof typeof BROWS;
  nose?: keyof typeof NOSES | 'none';
  mouth?: MouthKind | 'none';
  /** Degrees the head turns towards `lookAt` at full reach. */
  tilt?: number;
  /** Rise (artboard units) on each breath, in step with the body. */
  bob?: number;
  /** A motion of the whole head around its centre (a loop or a one-off). */
  loop?: {
    initial?: TargetAndTransition;
    animate: TargetAndTransition;
    transition: Transition;
  };
  /** `slow`: a rare, lingering blink (a calm guard) instead of the quick one. */
  blink?: 'quick' | 'slow';
}

const ink = { fill: 'none', stroke: C.ink } as const;

function Mouth({ kind }: { kind: MouthKind }): ReactNode {
  switch (kind) {
    case 'smile':
      return (
        <path
          d="M0 21V27M0 27C-4 33-12 32-14 27M0 27C4 33 12 32 14 27"
          {...ink}
          strokeWidth={2.5}
        />
      );
    case 'smile-big':
      return (
        <path
          d="M0 22V28M0 28C-4 34-12 33-14 28M0 28C4 34 12 33 14 28"
          {...ink}
          strokeWidth={2.5}
        />
      );
    case 'open':
      return (
        <>
          <path d="M0 21V25" {...ink} strokeWidth={2.5} />
          <circle
            cx={0}
            cy={31}
            r={6}
            fill={C.nose}
            stroke={C.ink}
            strokeWidth={2.5}
          />
        </>
      );
    case 'grin':
      // The tongue is drawn under the nose (see GrinTongue).
      return <path d="M0 21V25" {...ink} strokeWidth={2.5} />;
    case 'chain':
      return (
        <>
          <path d="M0 21V26" {...ink} strokeWidth={2.5} />
          <LinkChain />
        </>
      );
    case 'sad':
      return (
        <>
          <path d="M0 21V25M-11 34Q0 23 11 34" {...ink} strokeWidth={2.5} />
          <Tear />
        </>
      );
    case 'strain':
      return (
        <path
          d="M0 21V25M-12 31L-6 27L0 31L6 27L12 31"
          {...ink}
          strokeWidth={2.5}
        />
      );
    case 'flat':
      return <path d="M0 21V26M-8 30H8" {...ink} strokeWidth={2.5} />;
    case 'smirk':
      return <path d="M0 21V26M-12 26Q0 36 14 24" {...ink} strokeWidth={2.5} />;
    case 'wavy':
      return (
        <path
          d="M0 21V26M-9 31Q-4 27 0 31Q4 35 9 31"
          {...ink}
          strokeWidth={2.5}
        />
      );
    case 'stern':
      return <path d="M0 21V26M-9 30H9" {...ink} strokeWidth={2.5} />;
    case 'wobble':
      return (
        <path
          d="M0 21V26M-12 31Q-6 25 0 31Q6 37 12 31"
          {...ink}
          strokeWidth={2.5}
        />
      );
  }
}

/** link-copied: the link, held in the teeth, swings a little. */
function LinkChain() {
  return (
    <Move
      origin={[0, 27]}
      animate={{ rotate: [0, -5, 0, 4, 0] }}
      transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY }}
    >
      <rect
        x={-42}
        y={27}
        width={46}
        height={24}
        rx={12}
        {...ink}
        strokeWidth={11}
      />
      <rect
        x={-4}
        y={27}
        width={46}
        height={24}
        rx={12}
        {...ink}
        strokeWidth={11}
      />
      <rect
        x={-42}
        y={27}
        width={46}
        height={24}
        rx={12}
        fill="none"
        stroke={C.yarn}
        strokeWidth={6}
      />
      <rect
        x={-4}
        y={27}
        width={46}
        height={24}
        rx={12}
        fill="none"
        stroke={C.yarn}
        strokeWidth={6}
      />
    </Move>
  );
}

/** error: a tear that wells up and swells. */
function Tear() {
  return (
    <Move
      origin={[-48, 26]}
      animate={{ scale: [1, 1.12, 1], y: [0, 2, 0] }}
      transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY }}
    >
      <path
        d="M-48 26C-55 37-53 46-48 46C-43 46-41 37-48 26Z"
        fill={C.tear}
        stroke={C.ink}
        strokeWidth={2}
      />
    </Move>
  );
}

function clampPupil(
  base: number,
  other: number,
  gaze: number,
  otherGaze: number,
  room: number,
): number {
  const tx = base + gaze * PUPIL_REACH;
  const ty = other + otherGaze * PUPIL_REACH;
  const len = Math.hypot(tx, ty);
  const k = len > room ? room / len : 1;
  return tx * k - base;
}

function Eye({
  spec,
  side,
  blink,
}: {
  spec: Extract<EyesSpec, { kind: 'open' }>;
  side: 0 | 1;
  blink: ReturnType<typeof useAnimationControls>;
}) {
  const { animated, gazeX, gazeY } = useCatMotion();
  const dx = side * EYE_GAP;
  const irisY = spec.irisY ?? -6;
  const irisR = spec.irisR ?? 15;
  const [px, py, pr] = spec.pupil;
  // Pupil offset from the iris centre as drawn on the artboard.
  const bx = px - EYE_X;
  const by = py - irisY;
  const room = Math.max(irisR - pr, Math.hypot(bx, by));
  const ox = useTransform(() =>
    clampPupil(bx, by, gazeX.get(), gazeY.get(), room),
  );
  const oy = useTransform(() =>
    clampPupil(by, bx, gazeY.get(), gazeX.get(), room),
  );

  const pupil = (
    <>
      <circle cx={px + dx} cy={py} r={pr} fill={C.ink} />
      {spec.glint && (
        <circle
          cx={spec.glint[0] + dx}
          cy={spec.glint[1]}
          r={spec.glint[2]}
          fill={C.fur}
        />
      )}
    </>
  );
  const iris = <circle cx={EYE_X + dx} cy={irisY} r={irisR} fill={C.eye} />;

  if (!animated) {
    return (
      <g>
        {iris}
        {pupil}
      </g>
    );
  }
  return (
    <motion.g style={pivot([EYE_X + dx, irisY])} animate={blink}>
      {iris}
      <motion.g style={{ x: ox, y: oy }}>{pupil}</motion.g>
    </motion.g>
  );
}

const BLINK: TargetAndTransition = {
  scaleY: [1, 0.1, 1],
  transition: { duration: 0.18, ease: 'easeInOut' },
};

/** Lids down, a beat shut, lids up: unhurried. */
const SLOW_BLINK: TargetAndTransition = {
  scaleY: [1, 0.1, 0.1, 1],
  transition: { duration: 0.7, times: [0, 0.35, 0.6, 1], ease: 'easeInOut' },
};

function Eyes({ spec, pace }: { spec: EyesSpec; pace: 'quick' | 'slow' }) {
  const { animated } = useCatMotion();
  const blink = useAnimationControls();
  const slow = pace === 'slow';
  useEvery(
    () => {
      if (slow) {
        void blink.start(SLOW_BLINK);
        return;
      }
      // Now and then a double blink.
      void blink.start(BLINK).then(() => {
        if (Math.random() < 0.2) void blink.start(BLINK);
      });
    },
    slow ? 5000 : 3000,
    slow ? 9000 : 6000,
    animated && spec.kind === 'open',
  );

  if (spec.kind === 'closed') {
    return <path d={spec.d} fill="none" stroke={C.eye} strokeWidth={5} />;
  }
  return (
    <>
      <Eye spec={spec} side={0} blink={blink} />
      <Eye spec={spec} side={1} blink={blink} />
    </>
  );
}

/** Ear twitch: a quick flick around the ear base, now and then. */
const EAR_VARIANTS: Record<'left' | 'right', Variants> = {
  left: { rest: { rotate: 0 }, twitch: { rotate: [0, -12, 4, 0] } },
  right: { rest: { rotate: 0 }, twitch: { rotate: [0, 12, -4, 0] } },
};

function Ears() {
  const { animated } = useCatMotion();
  const left = useAnimationControls();
  const right = useAnimationControls();
  useEvery(
    () => {
      // One ear at a time.
      const ear = Math.random() < 0.5 ? left : right;
      void ear.start('twitch', { duration: 0.35, ease: 'easeOut' });
    },
    5000,
    11000,
    animated,
  );
  if (!animated) {
    return (
      <>
        <path d={EAR_L} fill={C.ink} />
        <path d={EAR_R} fill={C.ink} />
      </>
    );
  }
  return (
    <>
      <motion.path
        d={EAR_L}
        fill={C.ink}
        style={pivot([-48, -43])}
        variants={EAR_VARIANTS.left}
        initial="rest"
        animate={left}
      />
      <motion.path
        d={EAR_R}
        fill={C.ink}
        style={pivot([48, -43])}
        variants={EAR_VARIANTS.right}
        initial="rest"
        animate={right}
      />
    </>
  );
}

function Tilt({ deg, children }: { deg: number; children: ReactNode }) {
  const { animated, gazeX } = useCatMotion();
  const rotate = useTransform(gazeX, (v) => v * deg);
  if (!animated || deg === 0) return <>{children}</>;
  return <motion.g style={{ ...pivot([0, 0]), rotate }}>{children}</motion.g>;
}

function headTransform({ x, y, rotate, scale }: HeadProps): string {
  let t = `translate(${x} ${y})`;
  if (rotate) t += ` rotate(${rotate})`;
  if (scale) t += ` scale(${scale})`;
  return t;
}

/**
 * The head, in the artboards' draw order: ears, head, mask, outline, fold,
 * whiskers, eyes, brows, nose, mouth.
 */
export function Head(props: HeadProps) {
  const {
    eyes,
    whiskers = 'default',
    brows,
    nose = 'default',
    mouth = 'smile',
    tilt = 0,
    bob = 0,
    loop,
    blink = 'quick',
  } = props;

  let face = (
    <>
      <Ears />
      <ellipse cx={0} cy={0} rx={74} ry={64} fill={C.fur} />
      <path d={MASK} fill={C.ink} />
      <ellipse cx={0} cy={0} rx={74} ry={64} {...ink} strokeWidth={4} />
      <path d={FOLD} fill="none" stroke={C.brow} strokeWidth={2.5} />
      {whiskers !== 'none' && (
        <path
          d={WHISKERS[whiskers]}
          {...ink}
          opacity={0.45}
          strokeWidth={1.5}
        />
      )}
      <Eyes spec={eyes} pace={blink} />
      {brows && (
        <>
          <path d={BROWS[brows][0]} fill={C.ink} />
          <path d={BROWS[brows][1]} fill={C.ink} />
        </>
      )}
      {mouth === 'grin' && (
        <path
          d="M-12 25Q0 43 12 25Z"
          fill={C.nose}
          stroke={C.ink}
          strokeWidth={2.5}
        />
      )}
      {nose !== 'none' && (
        <path d={NOSES[nose]} fill={C.nose} stroke={C.ink} strokeWidth={2} />
      )}
      {mouth !== 'none' && <Mouth kind={mouth} />}
    </>
  );

  if (loop) {
    face = (
      <Move
        initial={loop.initial}
        animate={loop.animate}
        transition={loop.transition}
      >
        {face}
      </Move>
    );
  }

  const head = (
    <g transform={headTransform(props)}>
      <Tilt deg={tilt}>{face}</Tilt>
    </g>
  );

  if (!bob) return head;
  return (
    <Move animate={{ y: [0, -bob, 0] }} transition={BREATH}>
      {head}
    </Move>
  );
}
