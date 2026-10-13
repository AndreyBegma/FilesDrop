/**
 * One JSON line per event. Only event names, statuses and counts: never a
 * file name, a chat or user id, a link, a token or a message text.
 */
export type LogFields = Record<string, string | number | boolean | undefined>;

export type Logger = (event: string, fields?: LogFields) => void;

export const jsonLogger: Logger = (event, fields = {}) => {
  console.log(
    JSON.stringify({ time: new Date().toISOString(), event, ...fields }),
  );
};

export const silentLogger: Logger = () => {};

/** Rounds a size into a coarse bucket, so the log does not fingerprint files. */
export const sizeBucket = (bytes: number | undefined): string => {
  if (bytes === undefined) return 'unknown';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return '<1MB';
  if (mb < 10) return '1-10MB';
  if (mb < 50) return '10-50MB';
  return '50MB+';
};
