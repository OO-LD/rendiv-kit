// One PNG per still, from a bundle built once.
//
// `rendiv still` runs a full Vite production build and launches Chromium for
// every single frame, in a fresh Node process, so about ninety-five per cent of
// a still is paid for again at the next one. It also drops each build in a new
// os.tmpdir()/rendiv-bundle-<timestamp> and never removes it.
//
// This builds once into out/.bundle, opens one browser, and then per still opens
// a page and runs set-composition, set-frame, screenshot. The sequence is the
// one in @rendiv/renderer/dist/render-still.js, step for step, and a full pass
// comes out byte for byte identical to the CLI's. Measured on a 50 stage deck:
// about 1.7s per still against about 13.5s.
//
// The page is per still rather than per pass. Holding one page open across the
// deck is about three times faster again, and it loses the byte equality: a mark
// drawn at 92px on one board and at 30px on another comes back off by a few
// levels in its smallest glyphs, because Chromium keeps the decoded bitmap and
// rescales it rather than decoding again. Two stills differed that way,
// invisibly, and a fast path that is almost the same is a fast path nobody can
// use to check anything.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_BUNDLE_DIR, buildBundle, serve } from './bundle-cache.mjs';

// Swiftshader rather than the host GPU, so the same source produces the same
// pixels on a laptop, a workstation and a CI runner.
const BROWSER_ARGS = [
  '--disable-web-security',
  '--disable-features=IsolateOrigins',
  '--disable-site-isolation-trials',
  '--no-sandbox',
  '--force-color-profile=srgb',
  '--use-gl=angle',
  '--use-angle=swiftshader',
];

const mtimeOf = (file) => {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return Infinity;
  }
};

// Every file under `dir` whose extension can change a drawing. The sweep is over
// what is on disk rather than over a declared list, because a file the list
// misses is a PNG that silently stays wrong.
export function sourceFiles(dir, pattern = /\.(tsx?|jsx?|json|css)$/) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p, pattern);
    return pattern.test(e.name) ? [p] : [];
  });
}

// When a still is out of date.
//
// `shared` is the newest source every still depends on, so touching a theme or a
// component invalidates the whole set. `ownSourceDir` holds the files that each
// belong to exactly one still; they are kept out of `shared` and charged to
// their own still through `ownSourceOf`, so a correction to one drawing costs
// that drawing rather than the deck.
//
// A project with no per-still split passes neither and rebuilds together.
export function stalenessCheck({
  root,
  sourceDirs = ['src'],
  ownSourceDir,
  ownSourceOf,
  force = false,
}) {
  const perStill = ownSourceDir ? path.resolve(root, ownSourceDir) : null;
  const all = sourceDirs.flatMap((d) => sourceFiles(path.resolve(root, d)));

  // Computed once: a deck of fifty stills would otherwise stat every source
  // fifty times.
  const shared = Math.max(
    0,
    ...all.filter((f) => !perStill || path.dirname(f) !== perStill).map(mtimeOf),
  );

  return (still, outFile) => {
    if (force) return true;
    if (!fs.existsSync(outFile)) return true;
    // A declared per-still source that is missing means the still has no drawing
    // behind it any more, which is a staleness the caller should see rather than
    // an mtime of Infinity that marks it permanently dirty.
    const own = ownSourceOf ? mtimeOf(path.resolve(root, ownSourceOf(still))) : 0;
    const drawn = Math.max(shared, Number.isFinite(own) ? own : 0);
    return fs.statSync(outFile).mtimeMs < drawn;
  };
}

/**
 * @param {object} o
 * @param {string}   o.root        locates node_modules
 * @param {string}  [o.cwd]        where the build runs, when it is not `root`.
 *                                 They differ where several compositions share
 *                                 one install.
 * @param {string}   o.entry       entry module, relative to cwd ?? root
 * @param {string}   o.outDir      where the PNGs go, relative to cwd ?? root
 * @param {Array}    o.stills      [{ name, composition, frame, props?, outDir? }]
 * @param {object}  [o.props]      input props handed to every composition
 * @param {number}  [o.width]      probe viewport, defaults to the first composition
 * @param {number}  [o.height]
 * @param {boolean} [o.force]      render every still, stale or not
 * @param {string[]}[o.sourceDirs] directories scanned for staleness
 * @param {string}  [o.ownSourceDir] directory of files belonging to one still each
 * @param {Function}[o.ownSourceOf] still => path whose mtime affects only that still
 * @param {string}  [o.bundleDir]
 * @param {Function}[o.log]  (text, { progress, done }) => void. Defaults to a
 *                            writer that keeps each still on one line.
 */
export async function fastStills({
  root,
  cwd,
  entry = 'src/index.tsx',
  outDir = 'out/stills',
  stills,
  props = {},
  width = 1920,
  height = 1080,
  force = false,
  sourceDirs = ['src'],
  ownSourceDir,
  ownSourceOf,
  bundleDir = DEFAULT_BUNDLE_DIR,
  log = (text, opts) => (opts?.progress ? process.stdout.write(text) : console.log(text)),
}) {
  if (!stills?.length) throw new Error('fastStills: no stills requested');

  const base = cwd ? path.resolve(root, cwd) : path.resolve(root);

  // A still may name its own directory, so one pass can write both palettes of
  // a cut without bundling twice: the palette is an input prop, not a different
  // bundle.
  const dirFor = (s) => path.resolve(base, s.outDir ?? outDir);
  for (const dir of new Set(stills.map(dirFor))) fs.mkdirSync(dir, { recursive: true });

  const isStale = stalenessCheck({ root: base, sourceDirs, ownSourceDir, ownSourceOf, force });
  const fileFor = (s) => path.join(dirFor(s), `${s.name}.png`);
  const todo = stills.filter((s) => isStale(s, fileFor(s)));

  const started = Date.now();
  if (!todo.length) {
    log(`nothing to render in ${outDir}, ${stills.length} stills already up to date`);
    return { rendered: 0, skipped: stills.length, seconds: 0 };
  }

  // Imported here rather than at the top, so the staleness and source helpers in
  // this module stay usable in a project that renders through the CLI and never
  // installs a browser.
  const { chromium } = await import('playwright');

  const dir = await buildBundle({ root, cwd, entry, bundleDir, log });
  const server = await serve(dir);
  const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });

  // A context of its own per still, sized to the composition rather than to the
  // project default, so a composition that declared another size is not
  // screenshotted through the wrong window. The context is also what keeps the
  // image cache out of the next still, which is what the byte equality rests on.
  const pageFor = async (w, h) => {
    const context = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(server.url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__RENDIV_LOADED__ === true, { timeout: 30000 });
    return page;
  };

  try {
    const probe = await pageFor(width, height);
    const meta = new Map(
      (await probe.evaluate(() => window.__RENDIV_GET_COMPOSITIONS__())).map((c) => [c.id, c]),
    );
    await probe.context().close();

    for (const s of todo) {
      const comp = meta.get(s.composition);
      if (!comp) {
        throw new Error(
          `No composition ${s.composition} in the bundle. ` +
            `It holds: ${[...meta.keys()].join(', ')}`,
        );
      }
      // Through `log` rather than straight to stdout, so a caller that drives
      // many passes can quiet the per-still line and keep its own summary.
      log(`${s.name} (${s.composition} @ ${s.frame}) ... `, { progress: true });
      const page = await pageFor(comp.width, comp.height);
      await page.evaluate(
        ({ id, input }) => {
          window.__RENDIV_SET_INPUT_PROPS__(input);
          window.__RENDIV_SET_COMPOSITION__(id);
        },
        { id: s.composition, input: { ...props, ...(s.props ?? {}) } },
      );
      // A composition swap remounts the tree; the frame set below lands on the
      // new one only after React has committed it.
      await page.waitForTimeout(100);
      await page.evaluate((f) => window.__RENDIV_SET_FRAME__(f), s.frame);
      // Fonts, images and video posters register a hold while they load. A
      // screenshot taken before they resolve is a frame with the fallback face.
      await page.waitForFunction(() => window.__RENDIV_PENDING_HOLDS__() === 0, { timeout: 30000 });
      await page.screenshot({ path: fileFor(s), type: 'png', animations: 'disabled' });
      await page.context().close();
      log('ok', { done: true });
    }
  } finally {
    await browser.close();
    server.close();
  }

  const seconds = +((Date.now() - started) / 1000).toFixed(1);
  const skipped = stills.length - todo.length;
  log(
    `\n${todo.length} stills in ${outDir} in ${seconds}s` +
      `${skipped ? `, ${skipped} already up to date` : ''}`,
  );
  return { rendered: todo.length, skipped, seconds };
}
