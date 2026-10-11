# rendiv-kit

Shared mechanics for [rendiv](https://github.com/thecodacus/rendiv) video and
deck projects: a fast still pipeline, segmented rendering, slide primitives,
layout checks and deck exports.

Collected from eighteen projects that had grown by copying, all of which now
consume it. The kit mechanics
were byte-identical in all of them while the components had forked into three to
seven variants each, and every improvement stayed where it was made: the fast
still renderer in one talk, the PPTX export in another, the batched stills in a
third.

Nothing project-specific ships. Every threshold, path, token list and word list
is read from the consuming project's `rendiv.config.json`.

## Install

```bash
npm i github:OO-LD/rendiv-kit#v0.2.0
pip install "rendiv-kit @ git+https://github.com/OO-LD/rendiv-kit#subdirectory=python"
```

Start from `template/`, which is a working project: a timeline, two segments, a
theme, and drivers for stills, render and export.

## Why it is faster

`rendiv still` runs a full Vite production build and launches Chromium for every
single frame, in a fresh Node process. About ninety-five per cent of a still is
paid for again at the next one. It also leaves each build in
`os.tmpdir()/rendiv-bundle-<timestamp>` and removes none of them; the machine
this kit was collected on had **1681 of them, 2.5 GB**.

`fastStills` builds once into `out/.bundle`, serves it, and opens one browser.
Measured on this repository's own template, same machine, same stills:

| path | per still | 16 stills |
|---|---|---|
| `rendiv still` | 10.1 s | 161 s (extrapolated) |
| `fastStills` | 2.1 s marginal | 42.5 s measured |

**The output is byte-identical.** Verified over 8 stills: same md5, same size.
The sequence is the one in `@rendiv/renderer/dist/render-still.js`, step for
step.

Two things that are not done, deliberately:

- **One page across the whole pass** is about three times faster again and loses
  the byte equality. Chromium keeps the decoded bitmap and rescales rather than
  decoding again, so a mark drawn at 92px on one board and 30px on another comes
  back off by a few levels in its smallest glyphs. A fast path that is almost
  the same is a fast path nobody can check anything with.
- **Guessing what changed.** A still is stale when any source under `src/` is
  newer, swept from disk rather than from a declared list, because a file the
  list misses is a PNG that silently stays wrong. Per-segment sources are
  charged only to their own still, so a correction to one drawing costs one
  drawing.

`node/sweep.mjs` clears what earlier runs left in the temp directory.

## Export flavours

```bash
rendiv-export pdf          --stem my-talk
rendiv-export pptx-stills  --stem my-talk
rendiv-export pptx-video   --stem my-talk
rendiv-export pptx-settled --stem my-talk
```

| flavour | slide unit | payload |
|---|---|---|
| `pdf` | beat | still, 144 dpi, 13.333 x 7.5 in, matching the pptx exactly |
| `pptx-stills` | beat | still, full bleed, beat name in the slide notes |
| `pptx-video` | **beat** | that beat's clip, autoplaying on advance |
| `pptx-settled` | segment | the settled frame only, named for what it loses |

Three of the four are per beat, because beats replace each other as often as
they accumulate. A segment that shows records, then gaps, then a claim is three
pictures; one slide per segment keeps the last and drops the other two without
saying so.

`pptx-video` carries one clip per **beat**, not per segment. A clip covering a
whole segment plays every beat in it on a single advance: the room cannot be
stopped between two of them and the presenter cannot step back one. Clips are
cut out of the segment renders rather than rendered again, so what is in the
deck is frame for frame what is in the video, and they are re-encoded rather
than stream copied because a copy can only cut on a keyframe.

## Checks

```bash
node node_modules/rendiv-kit/node/checks/index.mjs
```

| check | what it enforces |
|---|---|
| `theme` | the palettes carry every token the kit components reach for, and agree with each other |
| `a11y` | contrast, type size, stroke width, dwell, safe area |
| `titles` | a kicker does not restate its section name |
| `budget` | the deck sums to its slot, and the parts keep their declared shape |
| `barred` | no withdrawn number or internal symbol reaches a slide |
| `novelty` | no clause reused from a prior deck |
| `stills` | no content drawn into the chrome gutter |

Each reports what it measured, and a check that could not measure something says
so rather than passing quietly. A configured input that is missing is a failure;
an unconfigured one is a skip, stated in the summary.

Thresholds are room-dependent and therefore live in the project. The defaults
suit a lecture hall; the template sets values for a video on a screen and says
which is which.

## Layout

```
src/        React side, shipped as TS source, bundled by the consumer
node/       build scripts: rendiv.mjs, fast-stills.mjs, bundle-cache.mjs,
            lock.mjs, contact-sheet.mjs, render-queue.mjs, sweep.mjs, checks/
python/     rendiv_kit: exports, vga, timeline
template/   a working project to copy
docs/       migration.md, upstream-rendiv.md
```

## Traps worth knowing

**Keep `resolve.dedupe`.** The kit's components call `useFrame()`, which reads a
context `@rendiv/core` creates. A second copy of `@rendiv/core` creates a second
context, so the kit components read frame 0 while the scenes around them read
the real one: entrance animations stay at opacity 0 and the still comes out as
empty background, successfully and without a warning. This was hit while
building the template.

**A project that serves its own fonts and renders on Linux should stay on the
per-frame path** until [docs/known-issues.md](docs/known-issues.md) is resolved.
`fastStills` and `rendiv still` agree byte for byte on Windows everywhere tried,
and disagree on webfont advance widths on a Linux runner.

**The bundler entry filename is fixed.** `@rendiv/bundler` writes
`__rendiv_entry__.jsx` into the project root, so two concurrent renders in one
directory clobber each other and return a black frame or a missing-module
error. `node/lock.mjs` serialises them.

## Tests

```bash
npm run check   # tsc --noEmit and 32 node tests
cd python && pytest tests   # 10 tests, including the per-beat slide unit
```
