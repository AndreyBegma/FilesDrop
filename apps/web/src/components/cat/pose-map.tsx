'use client';

import type { ComponentType } from 'react';
import type { CatPose } from './poses';
import { DeletePose } from './poses/delete';
import { DownloadPose } from './poses/download';
import { DragOverPose } from './poses/drag-over';
import { EmptyPose } from './poses/empty';
import { ErrorPose } from './poses/error';
import { FaviconPose } from './poses/favicon';
import { HoverPose } from './poses/hover';
import { IdlePose } from './poses/idle';
import { LinkCopiedPose } from './poses/link-copied';
import { LoadingPose } from './poses/loading';
import { LockedPose } from './poses/locked';
import { MainPose } from './poses/main';
import { NotFoundPose } from './poses/not-found';
import { OfflinePose } from './poses/offline';
import { SuccessPose } from './poses/success';
import { TooBigPose } from './poses/too-big';
import { UploadPose } from './poses/upload';
import { WrongPasswordPose } from './poses/wrong-password';

/** Every pose name renders exactly one artboard component. */
export const POSE_COMPONENTS = {
  main: MainPose,
  idle: IdlePose,
  hover: HoverPose,
  'drag-over': DragOverPose,
  upload: UploadPose,
  loading: LoadingPose,
  success: SuccessPose,
  'link-copied': LinkCopiedPose,
  error: ErrorPose,
  'too-big': TooBigPose,
  empty: EmptyPose,
  'not-found': NotFoundPose,
  delete: DeletePose,
  offline: OfflinePose,
  download: DownloadPose,
  favicon: FaviconPose,
  locked: LockedPose,
  'wrong-password': WrongPasswordPose,
} as const satisfies Record<CatPose, ComponentType>;
