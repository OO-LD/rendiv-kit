// rendiv.config.json: everything a check needs to know about one project.
//
// The checks were lifted from projects that had their thresholds, token lists
// and allowlists written into the check itself. That is why none of them could
// be shared: a check that knows a work package name is a check that belongs to
// one repository. Here the mechanism is the kit's and every number, path and
// name is read from this file.
import fs from 'node:fs';
import path from 'node:path';

export const CONFIG_NAME = 'rendiv.config.json';

// Thresholds a lecture hall enforces whether or not anyone checks them. These
// are defaults, not rules: a project that has measured its own room overrides
// them, and a project that has not gets numbers that are defensible.
export const DEFAULTS = {
  entry: 'src/index.tsx',
  srcDir: 'src',
  outDir: 'out',
  stillsDir: 'out/stills',
  segmentsDir: 'out/segments',
  bundleDir: 'out/.bundle',
  themeSource: 'src/theme.ts',
  // Timeline-driven projects set this; deck-driven ones set `deck` instead.
  timeline: null,
  deck: null,
  palettes: ['LIGHT', 'DARK'],
  a11y: {
    /** px. Anything under this is unreadable from the back row. */
    minSize: 28,
    /** px. The first thing an analogue chain removes. */
    minStroke: 2,
    /** seconds per reveal stage. */
    minDwell: 12,
    /** WCAG text. */
    minRatio: 4.5,
    /** WCAG graphical objects: nothing is spelled out in them. */
    minRatioGraphic: 3,
    /** Tokens a viewer reads as words. Held to the text floor on every surface. */
    bodyTokens: ['ink', 'muted', 'accent'],
    /** Drawn objects: rules, arrows, outlines. */
    graphicTokens: ['hairline'],
    /** Surfaces every foreground token is measured against. */
    surfaces: ['bg', 'panel'],
    allow: 'scripts/a11y-allow.json',
    safeAreaAllow: [],
  },
  budget: {
    /** Minutes the whole thing has. null skips the total check. */
    slotMinutes: null,
    /** Named parts and the minutes each is budgeted, for the shape check. */
    parts: {},
    tolerance: 0.5,
  },
  barred: {
    /** JSON array of terms that must not appear. */
    list: 'scripts/barred.json',
  },
  novelty: {
    /** Directory of a prior deck this one must not reuse sentences from. */
    against: null,
    /** Shared run of this many words or more is a failure. */
    words: 6,
    allow: 'scripts/novelty-allow.json',
  },
  titles: {
    /**
     * JSON map of "slideId.stageName" to kicker text. Unset reads the kicker
     * from each stage in the deck instead.
     */
    kickers: null,
  },
  stills: {
    /** The gutter between the chrome and the content, which nothing may draw in. */
    titleBandBottom: null,
    contentTop: null,
    width: 1920,
    /** Columns ignored at each edge, where furniture legitimately sits. */
    padX: 0,
    /** Luma spread a flat band is allowed. Above it, something is drawn there. */
    spreadTolerance: 6,
  },
};

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

const merge = (base, over) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(over ?? {})) {
    out[k] = isObject(v) && isObject(base[k]) ? merge(base[k], v) : v;
  }
  return out;
};

export function loadConfig(root = process.cwd()) {
  const file = path.resolve(root, CONFIG_NAME);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No ${CONFIG_NAME} in ${root}. The kit's checks read their thresholds and paths ` +
        'from it rather than carrying one project\'s numbers.',
    );
  }
  const config = merge(DEFAULTS, JSON.parse(fs.readFileSync(file, 'utf-8')));
  config.root = path.resolve(root);
  return config;
}

/** Resolves a config path against the project root, or null when unset. */
export const at = (config, relPath) =>
  relPath ? path.resolve(config.root, relPath) : null;

export function readJson(file, fallback) {
  if (!file || !fs.existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/** Every .ts/.tsx under a directory, which is what the source scanners walk. */
export function walk(dir, pattern = /\.tsx?$/) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, pattern) : pattern.test(e.name) ? [p] : [];
  });
}

export const relTo = (root, file) => path.relative(root, file).replace(/\\/g, '/');

/** `--only a,b` as a list, for checks that take a subset. */
export function parseOnly(argv) {
  const i = argv.indexOf('--only');
  if (i < 0) return [];
  return (argv[i + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Prints and exits. One shape for every check, so a build reads the same way. */
export function report(name, problems, summary) {
  if (problems.length) {
    console.error(`${name} failed:\n`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`${name}: ${summary}`);
}
