/**
 * The 16 mascot poses, one per artboard in docs/mascot/*.svg.
 * `pose-map.tsx` maps every name here to its component; the
 * `satisfies Record<CatPose, …>` there makes a missing pose a type error.
 */
export const CAT_POSES = [
  'main',
  'idle',
  'hover',
  'drag-over',
  'upload',
  'loading',
  'success',
  'link-copied',
  'error',
  'too-big',
  'empty',
  'not-found',
  'delete',
  'offline',
  'download',
  'favicon',
] as const;

export type CatPose = (typeof CAT_POSES)[number];

export interface CatPoseTraits {
  /** Source artboard, relative to docs/mascot/. */
  readonly artboard: `${string}.svg`;
  /**
   * Centre of the head in artboard coordinates (viewBox 0 0 400 400).
   * Pupils look from here towards `lookAt`. `null` = the pupils stay put
   * (closed eyes, spinning, startled).
   */
  readonly gaze: readonly [x: number, y: number] | null;
  /** Head tilt towards `lookAt`, in degrees at full reach (0 = none). */
  readonly tilt: number;
}

export const CAT_POSE_TRAITS = {
  main: { artboard: 'main.svg', gaze: [200, 140], tilt: 0 },
  idle: { artboard: 'idle.svg', gaze: null, tilt: 0 },
  hover: { artboard: 'hover.svg', gaze: [200, 160], tilt: 6 },
  'drag-over': { artboard: 'drag-over.svg', gaze: [200, 188], tilt: 0 },
  upload: { artboard: 'upload.svg', gaze: [154, 188], tilt: 0 },
  loading: { artboard: 'loading.svg', gaze: null, tilt: 0 },
  success: { artboard: 'success.svg', gaze: null, tilt: 0 },
  'link-copied': { artboard: 'link-copied.svg', gaze: [200, 140], tilt: 0 },
  error: { artboard: 'error.svg', gaze: [200, 148], tilt: 0 },
  'too-big': { artboard: 'too-big.svg', gaze: null, tilt: 0 },
  empty: { artboard: 'empty.svg', gaze: [130, 188], tilt: 0 },
  'not-found': { artboard: 'not-found.svg', gaze: [135, 191], tilt: 0 },
  delete: { artboard: 'delete.svg', gaze: null, tilt: 0 },
  offline: { artboard: 'offline.svg', gaze: null, tilt: 0 },
  download: { artboard: 'download.svg', gaze: [176, 168], tilt: 0 },
  favicon: { artboard: 'favicon.svg', gaze: [200, 212], tilt: 0 },
} as const satisfies Record<CatPose, CatPoseTraits>;

export function isCatPose(value: string): value is CatPose {
  return (CAT_POSES as readonly string[]).includes(value);
}
