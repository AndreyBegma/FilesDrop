'use client';

import {
  type MotionValue,
  motion,
  motionValue,
  type TargetAndTransition,
  type Transition,
} from 'motion/react';
import { createContext, type ReactNode, useContext } from 'react';

/** What every part needs to know about the cat it belongs to. */
export interface CatMotion {
  /** False under reduced motion: no loops, no springs, no pointer-follow. */
  readonly animated: boolean;
  /** Where the cat looks, -1…1 on each axis, already sprung. */
  readonly gazeX: MotionValue<number>;
  readonly gazeY: MotionValue<number>;
}

const still: CatMotion = {
  animated: false,
  gazeX: motionValue(0),
  gazeY: motionValue(0),
};

const CatMotionContext = createContext<CatMotion>(still);

export const CatMotionProvider = CatMotionContext.Provider;

export function useCatMotion(): CatMotion {
  return useContext(CatMotionContext);
}

type Point = readonly [x: number, y: number];

/**
 * SVG pivots: `transform-box: view-box` makes `transform-origin` a point in
 * the element's own user space, so origins can be written in the same
 * coordinates as the artwork paths.
 *
 * The origin must go through `originX`/`originY` (as px strings): motion
 * rebuilds `transform-origin` from them and ignores a raw `transformOrigin`
 * style on SVG elements. A bare number would be read as a fraction (50%).
 */
export function pivot([x, y]: Point) {
  return {
    transformBox: 'view-box',
    originX: `${x}px`,
    originY: `${y}px`,
  } as const;
}

interface MoveProps {
  /** Pivot for rotate/scale, in local artwork coordinates. */
  origin?: Point;
  initial?: TargetAndTransition;
  animate: TargetAndTransition;
  transition?: Transition;
  children: ReactNode;
}

/**
 * A group that moves only when the cat is animated. Under reduced motion it
 * renders a plain `<g>`, so the artwork stays exactly as drawn.
 *
 * Never put a `transform` attribute on the same element: the CSS transform
 * motion writes would replace it. Wrap a static `<g transform>` instead.
 */
export function Move({
  origin = [0, 0],
  initial,
  animate,
  transition,
  children,
}: MoveProps) {
  const { animated } = useCatMotion();
  if (!animated) return <g>{children}</g>;
  return (
    <motion.g
      style={pivot(origin)}
      initial={initial}
      animate={animate}
      transition={transition}
    >
      {children}
    </motion.g>
  );
}

/** An endless, eased loop. */
export function loop(duration: number, extra: Transition = {}): Transition {
  return {
    duration,
    repeat: Number.POSITIVE_INFINITY,
    ease: 'easeInOut',
    ...extra,
  };
}

/** Breathing rhythm, shared so body and head stay in step. */
export const BREATH = loop(4);

/** A spring for things that pop into place. */
export const POP: Transition = { type: 'spring', stiffness: 420, damping: 16 };
