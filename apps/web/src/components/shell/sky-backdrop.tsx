/**
 * The sky behind the app: four soft blobs of `--fd-sky`, `--fd-butter` and
 * `--fd-periwinkle` drifting on glass-ui's `lunaDrift*` paths, plus stars at
 * night. Styles live in `globals.css` (`.fd-sky`); it is still under
 * `prefers-reduced-motion`. Mount once, outside `#main-content`.
 */
export function SkyBackdrop() {
  return (
    <div className="fd-sky" aria-hidden="true">
      <span className="fd-blob fd-blob-sky" />
      <span className="fd-blob fd-blob-butter" />
      <span className="fd-blob fd-blob-periwinkle" />
      <span className="fd-blob fd-blob-butter-low" />
      <span className="fd-stars" />
    </div>
  );
}
