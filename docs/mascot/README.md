# Mascot source

The 16 SVG files in this folder are the source of truth for the FilesDrop cat,
a black-and-white Scottish Fold. They were exported verbatim from the design canvas
(viewBox `0 0 400 400`, transparent ground). The app does not ship these files.
It rebuilds them as a React component tree (`apps/web/src/components/cat/`)
so that each part can move on its own. When a pose changes, update the SVG here
first, then the component.

Do not commit raster exports (`*.zip`, PNG sheets). Favicon and OG images are
generated from `favicon.svg` and the poses.

## Poses

| File | Pose | Used for |
|---|---|---|
| `main.svg` | sitting, looking at the viewer | brand, idle fallback with reduced motion |
| `idle.svg` | curled up asleep, Z's, small progress bar | nothing happening (Z's and the bar are separate layers; the bar is dropped in the app) |
| `hover.svg` | peeking over a card, paws on the edge | pointer over the drop zone |
| `drag-over.svg` | paws up, catching a falling file | files dragged over the window |
| `upload.svg` | pushing a file into a box | upload starting |
| `loading.svg` | chasing its tail in a ring | indeterminate progress |
| `success.svg` | eyes closed, smiling, sparkles, green check | upload done |
| `link-copied.svg` | link chain in its teeth, green check | link copied |
| `error.svg` | sad brows, tear, red cross | upload failed |
| `too-big.svg` | straining to push a huge file into a small box | over 95 MB |
| `empty.svg` | sitting next to an empty folder | empty history, quota full |
| `not-found.svg` | head tilted at an empty box, question mark | 404 / 410 |
| `delete.svg` | sitting on a table, swiping a file off into a bin | delete from history |
| `offline.svg` | tangled in a cable, no-wifi badge | offline |
| `download.svg` | peeking out of a box holding a file | preview page |
| `favicon.svg` | head only, scaled 2.2× | favicon, app icon |
| `locked.svg` | guarding a box with a padlock, serious brows | password-protected file (`/v` locked) |
| `wrong-password.svg` | head shaking (tilt 10°, motion arcs), wavy mouth, red cross badge | wrong password |

## Parts (shared across poses)

All poses draw the same parts. Only their transforms and a few expression layers change.

| Part | Geometry (pose-local) | Notes |
|---|---|---|
| head | group `translate(200 140)` in sitting poses; ellipse `rx 74 ry 64` at origin | the head group is what tilts and follows the pointer |
| ears | `M-66 -28C-74 -60-52 -74-30 -58Z` and its mirror | folded; a small twitch is a rotate around the ear base |
| mask | the black path over the head, white blaze down the middle | — |
| eyes | `circle` at `(±34, -6)` r15, fill `#E9D54A` | iris |
| pupils | `circle` at `(±34, -6)` r9 to r10, fill `#1B1B20`, highlight r3 `#FFFFFF` at `(-3, -4)` from the pupil | pupils may move within the iris by ≤ 5 px; blink = scaleY of iris + pupil to 0.1 |
| closed eyes | arcs, stroke `#E9D54A` 5 px (`idle`, `success`) | replace iris and pupil |
| nose | `M-6 14H6L0 21Z` fill `#F3A0AA` | — |
| mouth | `M0 21V27…` | varies per expression |
| whiskers | 4 lines, opacity 0.45 | — |
| body | `M150 196C118 228 94 292 110 334…Z`, patches clipped to it | breathing = scaleY 1→1.03 around the base |
| tail | stroke 26 px `M288 326C322 372 196 376 128 356` | sway = rotate around its root |
| paws | ellipses `rx 21 ry 13` at y 340, toe lines | — |
| shadow | ellipse at y ~378, `#1B1B20` opacity 0.1 | scales with the jump in `drag-over` |

## Palette

| Token | Hex | Where |
|---|---|---|
| ink | `#1B1B20` | outlines, patches, pupils |
| fur | `#FFFFFF` | — |
| eye | `#E9D54A` | iris |
| nose | `#F3A0AA` | nose, tongue |
| brow | `#4A4A55` | fold line on the head |
| sky | `#DCE8F5` | canvas ground (not in the SVGs) |
| butter | `#FFE9A8` | alternative ground |
| periwinkle | `#9DB4D6` | lines on paper |
| yarn | `#3B6FE0` | link chain, progress, arrows |
| ok | `#2B9A63` | check badge |
| danger | `#D94A30` | cross / alert badge |
| box | `#E0B070`, `#B98443`, `#EBC48E`, `#8F6230` | cardboard |
| folder | `#F2C445`, `#D9A92E` | folder, sparkles |
| tear | `#6FB1F0` | tear, sweat drop |
