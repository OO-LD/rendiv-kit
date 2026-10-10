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
