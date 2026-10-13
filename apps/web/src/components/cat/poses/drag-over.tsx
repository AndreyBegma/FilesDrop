'use client';

import { loop, Move } from '../motion';
import { C } from '../palette';
import { Limb, Shadow, SittingCat, Toes } from '../parts/body';
import { Paper } from '../parts/props';

const JUMP = { type: 'spring', stiffness: 260, damping: 12 } as const;

/** One raised arm with its toes; it wiggles around the shoulder. */
function RaisedArm({
  d,
  toes,
  shoulder,
  dir,
}: {
  d: string;
  toes: string;
  shoulder: readonly [number, number];
  dir: 1 | -1;
}) {
  return (
    <Move
      origin={shoulder}
      animate={{ rotate: [0, 4 * dir, 0, -3 * dir, 0] }}
      transition={loop(0.9, { delay: dir === 1 ? 0 : 0.12 })}
    >
      <Limb d={d} outer={30} inner={21} />
      <Toes d={toes} />
    </Move>
  );
}

/** drag-over.svg: paws up, catching a falling file. */
export function DragOverPose() {
  return (
    <>
      <Move
        origin={[200, 72]}
        animate={{ y: [0, -7, 0], rotate: [0, 3, 0] }}
        transition={loop(1.6)}
      >
        <g transform="rotate(-8 200 72)">
          <Paper
            x={172}
            y={36}
            width={56}
            height={72}
            lines="M183 54H217M183 67H217M183 80H205"
          />
        </g>
      </Move>
      <Move animate={{ opacity: [1, 0.35, 1] }} transition={loop(0.8)}>
        <path
          d="M146 44V70M254 40V66M132 78V94M268 74V90"
          fill="none"
          stroke={C.ink}
          opacity={0.4}
          strokeWidth={3}
        />
      </Move>
      <g transform="translate(40 76) scale(0.8)">
        <Move
          origin={[200, 378]}
          initial={{ scale: 1.15 }}
          animate={{ scale: 1 }}
          transition={JUMP}
        >
          <Shadow cx={200} cy={378} rx={130} ry={10} />
        </Move>
        <Move initial={{ y: 48 }} animate={{ y: 0 }} transition={JUMP}>
          <SittingCat
            shadow={false}
            patches={[
              [122, 296, 36, 46],
              [284, 300, 32, 46],
            ]}
            beforeHead={
              <>
                <RaisedArm
                  d="M146 250C112 220 104 150 112 100"
                  toes="M107 92V102M117 92V102"
                  shoulder={[146, 250]}
                  dir={-1}
                />
                <RaisedArm
                  d="M254 250C288 220 296 150 288 100"
                  toes="M283 92V102M293 92V102"
                  shoulder={[254, 250]}
                  dir={1}
                />
              </>
            }
            head={{
              x: 200,
              y: 140,
              mouth: 'open',
              eyes: {
                kind: 'open',
                pupil: [-34, -11, 10],
                glint: [-37, -15, 3],
              },
            }}
          />
        </Move>
      </g>
    </>
  );
}
