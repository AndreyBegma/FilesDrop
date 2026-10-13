'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/** One paw print: a pad and four toes, in a 24×24 box. */
function Paw({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <g fill={color}>
        <ellipse cx="12" cy="16" rx="5.6" ry="4.6" />
        <ellipse cx="5.2" cy="10.4" rx="2.3" ry="2.9" />
        <ellipse cx="9.4" cy="6.4" rx="2.3" ry="3" />
        <ellipse cx="14.6" cy="6.4" rx="2.3" ry="3" />
        <ellipse cx="18.8" cy="10.4" rx="2.3" ry="2.9" />
      </g>
    </svg>
  );
}

type Piece = {
  id: number;
  dx: number;
  dy: number;
  rotate: number;
  size: number;
  delay: number;
  color: string;
};

const COLORS = ['var(--fd-nose)', 'var(--fd-eye)'];

function makeBurst(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    // A fan that opens upwards, a little wider than a half circle.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const distance = 60 + Math.random() * 90;
    return {
      id: i,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      rotate: (Math.random() - 0.5) * 140,
      size: 12 + Math.random() * 12,
      delay: Math.random() * 0.08,
      color: COLORS[i % COLORS.length],
    };
  });
}

/**
 * Paw-print confetti from a point on screen (the copy button). Each new
 * `burst` value fires once. Nothing at all under reduced motion.
 */
export function PawConfetti({
  burst,
  origin,
}: {
  burst: number;
  origin: { x: number; y: number } | null;
}) {
  const reduced = useReducedMotion();
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (burst === 0 || reduced) return;
    setPieces(makeBurst(14));
    const id = window.setTimeout(() => setPieces([]), 1400);
    return () => window.clearTimeout(id);
  }, [burst, reduced]);

  if (!origin || pieces.length === 0 || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-top"
      style={{ left: origin.x, top: origin.y, width: 0, height: 0 }}
    >
      {pieces.map((p) => (
        <motion.span
          key={`${burst}-${p.id}`}
          className="absolute block"
          style={{
            width: p.size,
            height: p.size,
            left: -p.size / 2,
            top: -p.size / 2,
          }}
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 1, rotate: 0 }}
          animate={{
            x: p.dx,
            y: [0, p.dy, p.dy + 50],
            scale: [0.3, 1, 0.9],
            opacity: [1, 1, 0],
            rotate: p.rotate,
          }}
          transition={{ duration: 1.1, delay: p.delay, ease: 'easeOut' }}
        >
          <Paw color={p.color} />
        </motion.span>
      ))}
    </div>,
    document.body,
  );
}
