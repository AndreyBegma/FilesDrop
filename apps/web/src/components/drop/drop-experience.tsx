'use client';

import { cn } from '@andrewbehma/glass-ui/cn';
import {
  FileDropzone,
  type FileRejection,
  sortFiles,
} from '@andrewbehma/glass-ui/file-dropzone';
import { toast } from '@andrewbehma/glass-ui/toast';
import { useFileUpload } from '@andrewbehma/glass-ui/use-file-upload';
import {
  MAX_FILE_BYTES,
  TTLS,
  type Ttl,
  type UploadResult,
} from '@filesdrop/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type CatPose } from '@/components/cat';
import { type HistoryEntry, historyStore } from '@/components/history/store';
import { DropStage } from './drop-stage';
import { describeFailure, type ErrorKey } from './errors';
import { useMascotCue, useOnline } from './hooks';
import { apiBase } from './links';
import { announce } from './live-region';
import { ResultCard } from './result-card';
import { TtlPicker } from './ttl-picker';
import { UploadRows } from './upload-rows';
import { UrlField } from './url-field';

/** How long a one-off pose holds before the cat goes back to its state. */
const HOLD: Partial<Record<CatPose, number>> = {
  success: 2600,
  'link-copied': 2600,
  delete: 1900,
  error: 4200,
  'too-big': 4200,
  empty: 5200,
  'not-found': 3200,
  offline: 3200,
};

function isUploadResult(value: unknown): value is UploadResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.slug === 'string' && typeof v.deleteToken === 'string';
}

function carriesFiles(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

export type StageMessage =
  | { kind: 'idle' }
  | { kind: 'drag' }
  | { kind: 'uploading'; count: number; percent: number }
  | { kind: 'fetching' }
  | { kind: 'success' }
  | { kind: 'copied' }
  | { kind: 'deleted' }
  | { kind: 'offline' }
  | { kind: 'error'; key: ErrorKey };

/**
 * The home page's working half: the drop zone with the cat, the TTL, the URL
 * field, the rows of what is uploading and the cards of what is done.
 */
export function DropExperience() {
  const t = useTranslations('Drop');
  const tErr = useTranslations('Errors');
  const online = useOnline();
  const reduced = useReducedMotion();

  const [ttl, setTtl] = useState<Ttl>('24h');
  const upload = useFileUpload({
    url: `${apiBase()}/api/files`,
    extraFields: { ttl },
    concurrency: 3,
  });

  const [results, setResults] = useState<HistoryEntry[]>([]);
  const [transient, setTransient] = useState<{
    pose: CatPose;
    message: StageMessage;
  } | null>(null);
  const transientTimer = useRef(0);
  const [hovering, setHovering] = useState(false);
  const [lookAt, setLookAt] = useState<{ x: number; y: number }>();
  const [windowDrag, setWindowDrag] = useState(false);
  const [fetching, setFetching] = useState(false);

  const flash = useCallback((pose: CatPose, message: StageMessage) => {
    window.clearTimeout(transientTimer.current);
    setTransient({ pose, message });
    transientTimer.current = window.setTimeout(
      () => setTransient(null),
      HOLD[pose] ?? 2400,
    );
  }, []);
  useEffect(() => () => window.clearTimeout(transientTimer.current), []);

  // Poses cued from elsewhere: a result card's copy, a history delete.
  const onCue = useCallback(
    (pose: CatPose) => {
      const message: StageMessage =
        pose === 'link-copied'
          ? { kind: 'copied' }
          : pose === 'delete'
            ? { kind: 'deleted' }
            : pose === 'offline'
              ? { kind: 'offline' }
              : pose === 'too-big'
                ? { kind: 'error', key: 'tooBig' }
                : pose === 'empty'
                  ? { kind: 'error', key: 'boxFull' }
                  : { kind: 'error', key: 'unknown' };
      flash(pose, message);
    },
    [flash],
  );
  useMascotCue(onCue);

  // A card whose file was deleted elsewhere (the history panel) goes too.
  useEffect(
    () =>
      historyStore.onRemove((slug) =>
        setResults((list) => list.filter((e) => e.slug !== slug)),
      ),
    [],
  );

  // A finished upload's card scrolls into view, gently, once it has risen.
  const resultsRef = useRef<HTMLDivElement>(null);
  const newest = results[0]?.slug;
  useEffect(() => {
    if (!newest) return;
    const id = window.setTimeout(() => {
      const card = resultsRef.current?.querySelector<HTMLElement>(
        `[data-slug="${newest}"]`,
      );
      if (!card) return;
      const rect = card.getBoundingClientRect();
      if (rect.bottom > window.innerHeight || rect.top < 0) {
        card.scrollIntoView({
          behavior: reduced ? 'auto' : 'smooth',
          block: 'nearest',
        });
      }
    }, 700);
    return () => window.clearTimeout(id);
  }, [newest, reduced]);

  const finish = useCallback(
    (result: UploadResult, source: HistoryEntry['source']) => {
      const entry: HistoryEntry = { ...result, source };
      historyStore.add(entry);
      setResults((list) => [
        entry,
        ...list.filter((e) => e.slug !== entry.slug),
      ]);
      flash('success', { kind: 'success' });
      announce(t('uploadedLive', { name: entry.name }));
    },
    [flash, t],
  );

  const fail = useCallback(
    (status: number | undefined, body: unknown, name?: string) => {
      const failure = describeFailure(status, body, navigator.onLine);
      flash(failure.pose, { kind: 'error', key: failure.key });
      const text = tErr(failure.key);
      announce(name ? `${name}: ${text}` : text);
      return failure;
    },
    [flash, tErr],
  );

  /* ------------------------------------------------ watching the upload queue */

  const reported = useRef(new Set<string>());
  const { items, remove } = upload;
  useEffect(() => {
    for (const item of items) {
      const { state } = item;
      if (state.status === 'done') {
        if (isUploadResult(state.response)) finish(state.response, 'file');
        else fail(500, undefined, item.file.name);
        remove(item.id);
      } else if (state.status === 'error') {
        if (reported.current.has(item.id)) continue;
        reported.current.add(item.id);
        fail(state.httpStatus, state.body, item.file.name);
      } else {
        reported.current.delete(item.id);
      }
    }
  }, [items, finish, fail, remove]);

  const active = items.filter(
    (i) => i.state.status === 'queued' || i.state.status === 'uploading',
  );
  const progress = useMemo(() => {
    let loaded = 0;
    let total = 0;
    for (const { file, state } of active) {
      total += file.size;
      if (state.status === 'uploading') loaded += state.loaded;
    }
    return total > 0 ? loaded / total : 0;
  }, [active]);

  const lastAnnounced = useRef(-1);
  useEffect(() => {
    if (active.length === 0) {
      lastAnnounced.current = -1;
      return;
    }
    // Every quarter, not every frame.
    const step = Math.floor(progress * 4);
    if (step !== lastAnnounced.current) {
      lastAnnounced.current = step;
      announce(
        t('uploadingLive', {
          count: active.length,
          percent: Math.round(progress * 100),
        }),
      );
    }
  }, [active.length, progress, t]);

  /* ----------------------------------------------------------- taking files */

  const onReject = useCallback(
    (rejections: FileRejection[]) => {
      const tooBig = rejections.filter((r) => r.reason === 'too-large');
      if (tooBig.length === 0) return;
      flash('too-big', { kind: 'error', key: 'tooBig' });
      for (const { file } of tooBig) {
        toast.error(tErr('tooBig'), { description: file.name });
      }
      announce(tErr('tooBig'));
    },
    [flash, tErr],
  );

  const add = upload.add;
  const take = useCallback(
    (files: File[]) => {
      const { accepted, rejected } = sortFiles(files, {
        maxSize: MAX_FILE_BYTES,
      });
      if (accepted.length > 0) {
        setTransient(null);
        add(accepted);
      }
      if (rejected.length > 0) onReject(rejected);
    },
    [add, onReject],
  );

  // Files dragged anywhere over the window wake the cat, and a drop that
  // misses the zone still lands instead of the browser opening the file.
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth += 1;
      setWindowDrag(true);
    };
    const leave = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setWindowDrag(false);
    };
    const over = (e: DragEvent) => {
      if (carriesFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      depth = 0;
      setWindowDrag(false);
      if (e.defaultPrevented || !carriesFiles(e)) return;
      e.preventDefault();
      take(Array.from(e.dataTransfer?.files ?? []));
    };
    const end = () => {
      depth = 0;
      setWindowDrag(false);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    window.addEventListener('dragend', end);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
      window.removeEventListener('dragend', end);
    };
  }, [take]);

  /* ------------------------------------------------------------ from a URL */

  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<ErrorKey | null>(null);
  const urlInput = useRef<HTMLInputElement>(null);

  // A link pasted while nothing is focused goes into the URL field.
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      if (e.defaultPrevented || isEditable(e.target)) return;
      if ((e.clipboardData?.files.length ?? 0) > 0) return;
      const text = e.clipboardData?.getData('text/plain').trim() ?? '';
      if (!/^https?:\/\/\S+$/i.test(text)) return;
      e.preventDefault();
      setUrl(text);
      setUrlError(null);
      urlInput.current?.focus();
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, []);

  const fetchUrl = async () => {
    const value = url.trim();
    let parsed: URL | null = null;
    try {
      parsed = new URL(value);
    } catch {
      parsed = null;
    }
    if (!parsed || !/^https?:$/.test(parsed.protocol)) {
      setUrlError('invalidUrl');
      flash('error', { kind: 'error', key: 'invalidUrl' });
      announce(tErr('invalidUrl'));
      return;
    }
    setUrlError(null);
    setTransient(null);
    setFetching(true);
    announce(t('fetchingLive', { host: parsed.host }));
    try {
      const res = await fetch(`${apiBase()}/api/files/from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value, ttl }),
      });
      const body: unknown = await res.json().catch(() => undefined);
      if (res.ok && isUploadResult(body)) {
        finish(body, 'url');
        setUrl('');
      } else {
        setUrlError(fail(res.status, body).key);
      }
    } catch {
      setUrlError(fail(undefined, undefined).key);
    } finally {
      setFetching(false);
    }
  };

  /* ------------------------------------------------------------ the pointer */

  const frame = useRef(0);
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const { clientX: x, clientY: y } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setLookAt({ x, y }));
    if (!hovering) setHovering(true);
  };
  const onPointerLeave = () => {
    cancelAnimationFrame(frame.current);
    setHovering(false);
    setLookAt(undefined);
  };

  /* ------------------------------------------------------------- the state */

  let pose: CatPose;
  let message: StageMessage;
  if (!online) {
    pose = 'offline';
    message = { kind: 'offline' };
  } else if (windowDrag) {
    pose = 'drag-over';
    message = { kind: 'drag' };
  } else if (transient) {
    pose = transient.pose;
    message = transient.message;
  } else if (active.length > 0) {
    pose = 'upload';
    message = {
      kind: 'uploading',
      count: active.length,
      percent: Math.round(progress * 100),
    };
  } else if (fetching) {
    pose = 'loading';
    message = { kind: 'fetching' };
  } else if (hovering) {
    pose = 'hover';
    message = { kind: 'idle' };
  } else {
    pose = 'idle';
    message = { kind: 'idle' };
  }

  const wasOnline = useRef(true);
  useEffect(() => {
    if (wasOnline.current && !online) announce(tErr('offline'));
    wasOnline.current = online;
  }, [online, tErr]);

  const busy = active.length > 0 || fetching;
  const ring =
    active.length > 0
      ? ({ kind: 'determinate', value: progress } as const)
      : fetching
        ? ({ kind: 'indeterminate' } as const)
        : null;

  const rows = items.filter((i) => i.state.status !== 'done');

  return (
    <div className="mt-9 flex w-full flex-col gap-4 sm:mt-12">
      <div onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <FileDropzone
          label={t('zoneLabel')}
          onFiles={take}
          onReject={onReject}
          maxSize={MAX_FILE_BYTES}
          pasteTarget="document"
          className={cn(
            'min-h-[22rem] w-full gap-0 rounded-sheet border-2 px-5 pt-6 pb-7 text-center sm:min-h-[27rem] sm:px-8',
            windowDrag && 'border-accent bg-accent-soft',
          )}
        >
          {({ dragging }) => (
            <DropStage
              pose={dragging ? 'drag-over' : pose}
              message={dragging ? { kind: 'drag' } : message}
              lookAt={lookAt}
              ring={ring}
              busy={busy}
            />
          )}
        </FileDropzone>
      </div>

      <div className="glass flex flex-col gap-3 rounded-sheet p-3 text-left sm:flex-row sm:items-start sm:gap-2 sm:p-2.5">
        <TtlPicker value={ttl} onChange={setTtl} options={TTLS} />
        <span
          aria-hidden="true"
          className="mx-1 hidden h-8 w-px self-center bg-line-strong sm:block"
        />
        <UrlField
          inputRef={urlInput}
          value={url}
          onChange={(v) => {
            setUrl(v);
            if (urlError) setUrlError(null);
          }}
          onSubmit={fetchUrl}
          busy={fetching}
          error={urlError ? tErr(urlError) : undefined}
        />
      </div>

      <UploadRows
        items={rows}
        onCancel={upload.cancel}
        onRetry={upload.retry}
        onRemove={(id) => {
          reported.current.delete(id);
          upload.remove(id);
        }}
      />

      <section
        ref={resultsRef}
        aria-label={t('resultsLabel')}
        className="flex flex-col gap-4 text-left empty:hidden"
      >
        <AnimatePresence initial={false}>
          {results.map((entry) => (
            <motion.div
              key={entry.slug}
              data-slug={entry.slug}
              layout={!reduced}
              initial={
                reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduced
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      x: 80,
                      rotate: 4,
                      transition: { duration: 0.28 },
                    }
              }
              transition={
                reduced
                  ? { duration: 0.15 }
                  : {
                      type: 'spring',
                      stiffness: 260,
                      damping: 24,
                      delay: 0.35,
                    }
              }
            >
              <ResultCard
                entry={entry}
                onDismiss={() =>
                  setResults((list) =>
                    list.filter((e) => e.slug !== entry.slug),
                  )
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </section>
    </div>
  );
}
