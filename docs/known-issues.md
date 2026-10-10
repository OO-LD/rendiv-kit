# Known issues

## fastStills and the CLI disagree on webfont text, on Linux

**Status:** open. Reproduces on CI, not on Windows.

Rendering the same frame through `fastStills` and through `rendiv still` gives
byte-identical output on Windows across every project tried. On a Linux CI
runner, two frames of one project came out a few pixels wider through
`fastStills`: the glyphs were right, the text's advance width was not, so boxes
sized to their content grew.

What is known:

- **Deterministic.** Two CI runs produced byte-identical images on each side.
  Not a race.
- **Confined to webfont text.** The two frames that differ are the only ones in
  that project carrying mono text. The other twelve match.
- **Only where a font is actually served.** A sibling project in the same
  repository declares the same `@font-face` families but ships no font files, so
  both paths fall back identically and nothing differs. 246 frames, no change.
- **Not the browser.** `@rendiv/renderer` launches Playwright's chromium with
  exactly the flags `fastStills` uses, and `openPage` creates the same context
  with the same viewport and `deviceScaleFactor: 1`.
- **Not the sequencing.** `fastStills` performs the same steps in the same order
  as `renderStill`, including its 100 ms settle.
- **Not the MIME types.** The static server in `bundle-cache.mjs` maps the font
  extensions the same way the renderer's own server does.
- **Not fixed by waiting for fonts.** 0.1.5 added `document.fonts.ready` on top
  of the pending-hold count. The output did not change.

What is left, and where to look next:

- The bundle. `rendiv still` builds with no `outDir`, into a temp directory;
  `fastStills` passes `outDir: out/.bundle` inside the project. If Vite treats
  the public directory or the asset base differently between the two, the font
  request could resolve in one and not the other. The copied `.woff2` files are
  present in `out/.bundle/fonts/` locally, so if this is the cause it is
  Linux-specific.
- Whether the font request 404s on the runner. Logging
  `document.fonts.check('400 30px "<family>"')` next to the screenshot would
  settle it in one run.

Until it is understood, a project that serves its own fonts **and** renders on
Linux should stay on the per-frame path. Four projects currently use
`fastStills` with webfonts; all of them render on Windows only, and all were
verified byte-identical there.
