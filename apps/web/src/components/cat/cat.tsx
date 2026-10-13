'use client';

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from 'motion/react';
import { type CSSProperties, useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { type CatMotion, CatMotionProvider, pivot } from './motion';
import { POSE_COMPONENTS } from './pose-map';
import { CAT_POSE_TRAITS, type CatPose } from './poses';

export interface CatProps {
  pose: CatPose;
  /** Pointer position in viewport coordinates (clientX/clientY). */
  lookAt?: { x: number; y: number };
  /** Width and height in px. Without it the cat fills its container's width. */
  size?: number;
  /** Accessible name, already localized. Without it the cat is decorative. */
  label?: string;
  /** Force the still version (also used when the OS asks for reduced motion). */
  reducedMotion?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** How far (in cat widths) the pointer must be for the gaze to max out. */
const GAZE_REACH = 0.75;
const GAZE_SPRING = { stiffness: 170, damping: 20, mass: 0.6 };

/**
 * The FilesDrop cat. One `<svg>` per instance; every artboard of
 * docs/mascot/ is a pose. Pose changes cross-fade (and spring, when motion
 * is allowed); under reduced motion the poses are the static artboards.
 */
export function Cat({
  pose,
  lookAt,
  size,
  label,
  reducedMotion = false,
  className,
  style,
}: CatProps) {
  const systemReduced = useReducedMotion();
  const animated = !(reducedMotion || systemReduced);

  const svgRef = useRef<SVGSVGElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const gazeX = useSpring(rawX, GAZE_SPRING);
  const gazeY = useSpring(rawY, GAZE_SPRING);

  const head = CAT_POSE_TRAITS[pose].gaze;
  const lx = lookAt?.x;
  const ly = lookAt?.y;

  useEffect(() => {
    const svg = svgRef.current;
    if (!animated || !head || lx === undefined || ly === undefined || !svg) {
      rawX.set(0);
      rawY.set(0);
      return;
    }
    const rect = svg.getBoundingClientRect();
    const unit = rect.width / 400;
    const dx = lx - (rect.left + head[0] * unit);
    const dy = ly - (rect.top + head[1] * unit);
    const reach = Math.max(rect.width * GAZE_REACH, 1);
    const len = Math.hypot(dx, dy) / reach;
    const k = len > 1 ? 1 / len : 1;
    rawX.set((dx / reach) * k);
    rawY.set((dy / reach) * k);
  }, [animated, head, lx, ly, rawX, rawY]);

  const ctx = useMemo<CatMotion>(
    () => ({ animated, gazeX, gazeY }),
    [animated, gazeX, gazeY],
  );

  // The first pose appears as is (no fade on page load). Later poses
  // cross-fade in. This is not done with `<AnimatePresence>`
  // because that would also freeze every loop inside the first pose.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const enter = !mounted.current
    ? false
    : animated
      ? { opacity: 0, scale: 0.92 }
      : { opacity: 0 };

  const Pose = POSE_COMPONENTS[pose];

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 400"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={className}
      style={{
        display: 'block',
        ...(size === undefined && { width: '100%', height: 'auto' }),
        ...style,
      }}
      data-pose={pose}
    >
      <CatMotionProvider value={ctx}>
        <g strokeLinecap="round" strokeLinejoin="round">
          <AnimatePresence>
            <motion.g
              key={pose}
              style={pivot([200, 380])}
              initial={enter}
              animate={{ opacity: 1, scale: 1 }}
              exit={
                animated
                  ? { opacity: 0, scale: 0.96, transition: { duration: 0.18 } }
                  : { opacity: 0, transition: { duration: 0.2 } }
              }
              transition={
                animated
                  ? {
                      opacity: { duration: 0.22 },
                      scale: { type: 'spring', stiffness: 380, damping: 22 },
                    }
                  : { duration: 0.2 }
              }
            >
              <Pose />
            </motion.g>
          </AnimatePresence>
        </g>
      </CatMotionProvider>
    </svg>
  );
}
