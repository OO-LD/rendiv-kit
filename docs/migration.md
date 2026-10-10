# Migrating a project onto rendiv-kit

Seventeen projects across six locations share the mechanics this kit now holds.
This is the recipe for moving one of them onto it.

The test is byte equality. Each project holds committed stills and rendered
mp4s, so a migration is correct exactly when it reproduces them.

## Inventory

| Location | Projects |
|---|---|
| `OO-LD/oold-schema/media` | `explainer`, `tutorials` (ep1-5 + `shared`) |
| `OO-LD/awl-python/media` | `explainer`, pinned via `kit-pin.json` |
| `OO-LD/project-management/second-stage/pitch` | pitch deck, via `design-pin.json` |
| `ISC-Digital/.../2026-07-22_PFAROS/media` | `pfaros-explainer`, `wp2-explainer` |
| `ISC-Digital/documents/latex/MSE2026/talks` | `mse2026-d01`, `mse2026-d10`, `mse2026-d10-v2` |
| `src/mc-explainers` | `wp01`, `wp02`, `wp03`, `wp05`, `wp11` (no git) |
| `2025_BW2/.../assessment` | `talk1_rendiv`, `talk2_rendiv`, `talk2_v2_rendiv` |

Suggested order, easiest first so the recipe is proven before it meets the
awkward cases:

1. `oold-schema/media/explainer` and `tutorials`, the baseline the kit was taken
   from and the reference for what must not change
2. `awl-python/media/explainer`, dropping `kit-pin.json` and `sync-kit.mjs`
3. PFAROS `pfaros-explainer`, `wp2-explainer`
4. `mc-explainers` wp01/02/03/05/11, and **`git init` it**: it has no version
   control today, so there is nothing to compare a mistake against
5. MSE2026 d01, d10, d10-v2, which also take the export correction
6. `talk1_rendiv`, `talk2_rendiv`, `talk2_v2_rendiv`. Last, because `talk2_v2`
   is where the fast still path came from and is worth keeping as a reference
   while the kit is being proved
7. `project-management/second-stage/pitch`, dropping `design-pin.json`,
   `sync-design.mjs` and `shared/kit`

## Before you start

Record what the project currently produces, so the comparison is possible:

```bash
cd <project>
cp -r out/stills /tmp/<project>-before
md5sum out/stills/*.png | sort > /tmp/<project>-before.md5
```

## Steps

**1. Install the kit.**

```bash
npm i github:simontaurus/rendiv-kit#v0.1.0
pip install "rendiv-kit @ git+https://github.com/simontaurus/rendiv-kit#subdirectory=python"
```

**2. Delete the vendored kit.** `rm -rf kit/` or `../kit/`, plus `kit-pin.json`,
`design-pin.json`, `scripts/sync-kit.mjs`, `scripts/sync-design.mjs`. The
pin-and-sync machinery existed because `media/kit` had no `package.json` and
could not be installed; npm does that job now.

**3. Rewrite imports.**

| from | to |
|---|---|
| `../kit/rendiv.mjs` | `rendiv-kit/node` |
| `@kit/motion`, `../lib/motion` | `rendiv-kit/motion` |
| `@kit/Footer`, `./components/Footer` | `rendiv-kit` |
| `../lib/fonts` | `rendiv-kit/fonts` |

**4. Adopt the theme contract.** The kit components take the palette from
context rather than importing a project module, so:

- rename the project's lead colour to `accent` (it was `teal`, `oold` or
  `accent` depending on the project)
- make sure `bg`, `ink`, `muted`, `hairline`, `panel`, `accent`, `fonts.sans`,
  `fonts.mono`, `layout.padX` and `layout.padY` all exist
- export a `themeFor(name)` returning a `Theme`, as in `template/src/theme.ts`
- wrap each composition in `<ThemeProvider theme={themeFor(theme)}>`

`node node_modules/rendiv-kit/node/checks/theme.mjs` tells you what is missing.

**5. Move project data into `rendiv.config.json`.** Everything the old scripts
had written into themselves: thresholds, token lists, the barred list path, the
novelty comparison directory, the slot length and part budgets. Start from
`template/rendiv.config.json`.

**6. Keep `resolve.dedupe` in `vite.config.ts`.** Drop the `@kit` alias and the
`tsconfig.json` `paths` catch-all, which only existed because the kit was a
sibling directory. Keep the dedupe list: a second `@rendiv/core` gives the kit
components their own frame context and renders blank frames that report success.

**7. Point `postinstall` at the kit.**

```json
"postinstall": "node node_modules/rendiv-kit/node/patch-rendiv.mjs"
```

**8. Switch the still driver to the fast path.** Copy
`template/scripts/stills.mjs` and adjust the beat source. Projects driven by a
`deck.json` rather than a `timeline.json` build the still list from the deck
instead; `stageFramesOf` in `rendiv-kit` does that.

**9. Add to `.gitignore`:** `out/.bundle/`, `out/.bundler-lock/`,
`out/beat-clips/`, `__rendiv_entry__.jsx`, `__rendiv_entry__.html`.

## Verify

```bash
npm run typecheck
node node_modules/rendiv-kit/node/checks/index.mjs
node scripts/stills.mjs --force --out out/_verify
md5sum out/_verify/*.png | sed 's|_verify|stills|' | sort > /tmp/<project>-after.md5
diff /tmp/<project>-before.md5 /tmp/<project>-after.md5 && echo "identical"
```

Any difference is a regression rather than a judgement call: both sides come
from the same toolchain, so identical pixels produce identical files.

Then the video, where the project has one:

```bash
node scripts/render.mjs
ffprobe -v error -show_entries format=duration -of csv=p=0 out/<video>.mp4
```

Duration and frame count must match what is committed, and `assertNoBlackFrames`
must pass.

## Expect these

**The checks will fail the first time.** They were never run against most of
these projects. Read each finding before raising a threshold: the template's own
palette turned out to miss the 3:1 graphic floor by 0.06.

**Motion defaults differ.** The kit ships the values most projects used; PFAROS
entered over 16 frames from 26px rather than 15 from 28. If stills do not match,
call `configureMotion` once with the project's numbers rather than editing call
sites.

**`window` is now `holdBetween`.** The old name shadowed the global inside every
module that imported it.

**Segment renders are named by segment id exactly.** Lowercasing resolves on
Windows and fails on a case-sensitive filesystem, and the deck export looks a
segment up by its id.

## After all of them

`node node_modules/rendiv-kit/node/sweep.mjs --dry-run` counts what
`@rendiv/cli` left behind over the life of these projects. It was 1681
directories and 2.5 GB when the kit was written. Projects on the fast path stop
adding to it.
