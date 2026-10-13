export const MIME_SNIFFER = Symbol('MIME_SNIFFER');

export type SniffedType = { ext: string; mime: string };

/** Identifies a file from its first bytes; `undefined` when unknown. */
export type MimeSniffer = (
  head: Uint8Array,
) => Promise<SniffedType | undefined>;

type FileTypeModule = {
  fileTypeFromBuffer(input: Uint8Array): Promise<SniffedType | undefined>;
};

let fileType: FileTypeModule | undefined;

/**
 * `file-type` is ESM-only. Node 24 loads it through `require(esm)`; it is
 * loaded lazily so that importing this module never pulls it in (Jest without
 * `--experimental-vm-modules` cannot evaluate ESM and injects a stub instead).
 */
export const fileTypeSniffer: MimeSniffer = async (head) => {
  fileType ??= require('file-type') as FileTypeModule;
  return fileType.fileTypeFromBuffer(head);
};
