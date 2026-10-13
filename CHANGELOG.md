# Changelog

## 0.1.0

First release. Collected from seventeen rendiv projects that had grown by
copying.

### Added

- `node/rendiv.mjs`: CLI and ffmpeg resolution, argument parsing, `still`,
  `stills`, `render`, `renderSegmented`, `assertNoBlackFrames`
- `node/fast-stills.mjs`: one bundle, one browser, one context per still.
  2.1 s per still against 10.1 s through `rendiv still`, byte-identical output
- `node/bundle-cache.mjs`: bundle pinned under `out/.bundle`, plus a sweep for
  what `@rendiv/cli` left in the system temp directory
- `node/lock.mjs`: serialises renders that share `__rendiv_entry__.jsx`
- `node/beats.mjs`: the timeline contract and its frame arithmetic
- `node/checks/`: theme, a11y, titles, budget, barred, novelty, stills
- `node/contact-sheet.mjs`, `node/render-queue.mjs`, `node/sweep.mjs`
- `src/`: `Stage`, `Slide`, `Type`, `CodeBlock`, `Cards`, `Footer`, `TitleCard`,
  behind a theme contract, as the union of the forked variants
- `python/rendiv_kit`: four export flavours, projector simulation, timeline
- `template/`: a working project

### Fixed, relative to the sources this was collected from

- `pptx-video` cuts one clip per **beat**. The implementation it came from cut
  one per segment, so every beat of a segment played on a single advance and
  per-beat navigation was gone
- `playwright` is declared. The project the fast path came from imported it
  without listing it as a dependency
- the main-module guard matches on Windows and through a symlinked package. The
  original spelling made every CLI entry point a silent no-op
- segment renders are named by segment id exactly, not lowercased
- the dwell floor applies to deck stages, not to video beats

### Changed

- `window` is `holdBetween`; the old name shadowed the global
- motion timings move to one `configureMotion` call rather than per-call defaults
- `CodeBlock` groups are a caller-supplied tone map rather than a fixed
  vocabulary
- `loadFonts` takes the face list; the kit ships no typeface
- no palette ships. `src/theme-contract.json` states the required tokens and
  `node/checks/theme.mjs` enforces them

## 0.1.1

### Fixed

- the export map doubled the extension, so `rendiv-kit/node/foo.mjs` resolved
  to `node/foo.mjs.mjs`. Both spellings now map to the same file
- `Card` consults the theme only for defaults and no longer requires a
  provider, so a project can adopt one component without mounting one

## 0.1.2

### Removed

- `stills()`. It screenshotted without waiting for the frame to settle, so a
  still could come back carrying a neighbouring beat's picture. Two consecutive
  runs agreed with each other, which is what hid it; runs under different load
  did not. A committed still in a real project was wrong this way, and the
  independent `rendiv still` reference confirmed which output was correct.
  Use `fastStills`, which waits on the pending-hold count and matches the CLI
  byte for byte.

### Migrated onto it

All eighteen projects across seven repositories. Twelve had committed stills to
check against and reproduced them byte for byte; the other six render clean.
Eight now use `fastStills`, which cut their still passes by three to four times.

## 0.1.3

### Added

- `fastStills` and `buildBundle` take a `cwd` separate from `root`, for a series
  that keeps one install at its root and an entry point per episode. The bundler
  lock follows `cwd`, which is where `__rendiv_entry__.jsx` lands
- a still may name its own `outDir`, so one pass writes every palette of a cut.
  The palette is an input prop, not a different bundle, so bundling twice for it
  was waste

## 0.1.4

### Fixed

- the per-still progress line went straight to stdout, so a caller driving many
  passes could not quiet it. It goes through `log` now, which takes a second
  argument saying whether the text is progress or a finished line

## 0.1.5

### Fixed

- `fastStills` waits for `document.fonts.ready` as well as the pending-hold
  count. The holds do not fully cover the font set, so a screenshot could be
  taken with a face still in flight: the glyphs then come from the fallback and
  only the text's width changes, which looks plausible and is wrong by a few
  pixels. CI on Linux caught this on the two mono-heavy frames of a project
  whose other twelve matched.

## 0.2.0

Moved to the OO-LD organisation: `github:OO-LD/rendiv-kit`. The minor bump is
the import path changing, not the code.

## 0.3.0

### Added

- `Frame`, `SceneStack` and `Furniture`, for anything that outlives a scene.
  Four separate things go wrong without them, and the component comments name
  each one: inheriting a scene's dissolve, compositing twice while two scenes
  are mounted, painting under `Sequence`'s z-index, and falling back to the
  browser default serif outside a `Stage`.

### Removed

- `Stage`'s `footer` prop. It sat inside the scene's `opacity`, so a footer
  passed there dissolved with the scene: measured alpha held at 1.000 and dipped
  to 0.355 over 14 frames at every boundary. Furniture belongs in `Furniture`,
  where the dip is not representable.
