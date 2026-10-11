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
- **Not the font request.** Inlining the faces as `data:` URIs, so there is no
  font request at all, left the rendered frames byte-identical to before. That
  rules out the fetch losing a race against the screenshot, which had been the
  leading theory: the sibling project that never showed the problem inlines its
  faces, and that turned out to be a coincidence rather than the cause.

What is left, and where to look next:

- The bundle. `rendiv still` builds with no `outDir`, into a temp directory;
  `fastStills` passes `outDir: out/.bundle` inside the project. Something about
  the build, rather than the serving, is the remaining difference between them.
- Whether the face is applied at all on the runner. Logging
  `document.fonts.check('400 30px "<family>"')` and the computed
  `font-family` of a mono node next to the screenshot would settle in one run
  whether this is a font problem or a layout one.
- Whether it is a font problem at all. The glyph shapes look right in the
  comparison; only the advance widths differ. That is also what a different
  `zoom`, `deviceScaleFactor` or text-size-adjust would produce.

Until it is understood, a project that serves its own fonts **and** renders on
Linux should stay on the per-frame path. Four projects currently use
`fastStills` with webfonts; all of them render on Windows only, and all were
verified byte-identical there.
