# What this kit works around in rendiv

Each of these is a patch or an avoidance the kit carries. They are listed so the
reason survives the person who found it, and so each can be dropped when
upstream fixes it.

Against `@rendiv/*` 0.2.6.

## Windows backslashes in the entry path

**Filed:** https://github.com/thecodacus/rendiv/issues/11
**Carried by:** `node/patch-rendiv.mjs`, run from `postinstall`

`@rendiv/bundler` interpolates the absolute entry path into
`import '${importPath}'` without normalising it. On Windows the backslashes
become string escapes, so a path with a segment like `\2025-11-26_Project` is
read as an octal escape and Rollup fails to resolve the entry. `@rendiv/studio`
already normalises its equivalent path; the renderer path does not.

The patch rewrites one line in
`node_modules/@rendiv/bundler/dist/render-entry-code.js`. It is deliberately not
fatal when the anchor is absent, so a bumped version that fixed this upstream
does not break `npm ci`.

## `-shortest` truncates the video when the audio ends first

**Not yet filed.** A complete issue with a reproduction is drafted at
`ownCloud/Projekte/2025-11-26_PrototypeFund/media/rendiv-issue-shortest.md`.

`stitch-frames-to-video` appends `-shortest` unconditionally. The comment reads
"ensure output duration matches the video", but `-shortest` clamps to whichever
stream is shorter. When the last audio ends before the last frame, ffmpeg
truncates the **video**.

A 150-frame composition whose only audio is a 1-second clip reports
`Done! Video rendered (150 frames)` and writes a file of `Duration: 00:00:01.00`.
Exit code 0, no warning. A real 5360-frame explainer lost its closing 215 frames
this way.

`-apad` alongside `-shortest`, or `-t <videoDuration>`, keeps the intended clamp
without dropping video.

## `--frames` names intermediate PNGs by absolute frame number

**Not yet filed.**
**Avoided by:** `renderSegmented` in `node/rendiv.mjs`

`--frames` would express a range of the full timeline and keep cross-dissolves
intact, which is what segmented rendering actually wants. But it names its
intermediate PNGs by absolute frame number, `frame-000346.png`, while ffmpeg's
`%06d` input sequence starts at zero, so an offset range fails to open.

So every segment the kit renders starts at frame 0 instead. That works only for
hard cuts: a segment rendered on its own has nothing underneath a cross-dissolve,
the incoming fade resolves against a transparent canvas, and it encodes as black.
`renderSegmented` therefore refuses any `overlap` other than 0, and
`assertNoBlackFrames` checks the stitched file for exactly the failure it is
built to avoid.

## The bundle is left in the temp directory

**Not yet filed.**
**Avoided by:** `node/bundle-cache.mjs`, cleared by `node/sweep.mjs`

`@rendiv/cli` builds a fresh Vite production bundle per invocation into
`os.tmpdir()/rendiv-bundle-<timestamp>` and removes none of them. A project
rendered a few hundred times leaves a few hundred copies: **1681 directories,
2.5 GB** on the machine this kit was collected from.

`fastStills` pins its bundle under `out/.bundle`, which is overwritten,
gitignored, and removed with the rest of `out/`.

## The bundler entry filename is fixed

**Not yet filed.**
**Avoided by:** `node/lock.mjs`

`@rendiv/bundler` writes `__rendiv_entry__.jsx` into the project root and removes
it once the bundle is built, so the filename is shared by every render in that
directory. Two at once means the second overwrites the first's entry or deletes
it mid-build, and what comes back is a black frame or a bundler error about a
missing module. Parallel work on one project makes that the normal case.

A unique filename per bundle, or an entry written to a temp directory, would
remove the need for the lock.

## Input props replace rather than merge with defaultProps

**Not yet filed.**
**Avoided by:** the composition binding in `template/src/index.tsx`

Setting input props on a loaded bundle replaces them wholesale, so a value
carried only in a composition's `defaultProps` does not survive into a render
driven by a still tool. A root that looks its component up by an id taken from
props then resolves to nothing and every frame comes out as empty background,
successfully.

The template binds each composition to its own component instead of looking one
up at render time, which does not depend on the merge behaviour either way.
