import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  type LucideIcon,
} from 'lucide-react';

const ARCHIVES = new Set(['zip', 'rar', '7z', 'gz', 'tgz', 'tar', 'bz2', 'xz']);
const SHEETS = new Set(['csv', 'xls', 'xlsx', 'ods', 'numbers']);
const CODE = new Set([
  'json',
  'html',
  'css',
  'ts',
  'tsx',
  'py',
  'go',
  'rs',
  'xml',
  'yml',
  'yaml',
  'md',
  'svg',
]);

/** A type glyph for files that cannot be shown as themselves. */
export function glyphFor(mime: string, ext: string): LucideIcon {
  const e = ext.toLowerCase();
  if (ARCHIVES.has(e)) return FileArchive;
  if (SHEETS.has(e)) return FileSpreadsheet;
  if (CODE.has(e)) return FileCode;
  if (mime.startsWith('image/')) return FileImage;
  if (mime.startsWith('video/')) return FileVideo;
  if (mime.startsWith('audio/')) return FileAudio;
  if (
    mime.startsWith('text/') ||
    mime === 'application/pdf' ||
    e === 'pdf' ||
    e === 'doc' ||
    e === 'docx'
  ) {
    return FileText;
  }
  return File;
}

export function FileGlyph({
  mime,
  ext,
  className,
}: {
  mime: string;
  ext: string;
  className?: string;
}) {
  const Icon = glyphFor(mime, ext);
  return <Icon aria-hidden="true" className={className} strokeWidth={1.75} />;
}
