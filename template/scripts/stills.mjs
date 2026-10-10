// One PNG per beat, through the fast path.
//
//   node scripts/stills.mjs                  every beat that is out of date
//   node scripts/stills.mjs S1 --force       one segment, stale or not
//   node scripts/stills.mjs --theme dark
//   node scripts/stills.mjs --settled        the end of each beat, for a deck
//   node scripts/stills.mjs --per-segment    one still per segment, for pptx-settled
import {
  fastStills,
  loadTimeline,
  matches,
  parseArgs,
  settledStillsFromTimeline,
  stillsFromTimeline,
} from 'rendiv-kit/node';

const root = process.cwd();
const { values, flags, filters } = parseArgs(process.argv.slice(2), ['theme', 'out']);
const theme = values.theme ?? 'light';

const timeline = loadTimeline(root);

// Per beat by default, because beats replace each other as often as they
// accumulate: one still per segment keeps the last and drops the rest without
// saying so. --per-segment is for the export flavour that wants exactly that.
const all = flags.has('per-segment')
  ? settledStillsFromTimeline(timeline)
  : stillsFromTimeline(timeline, { sample: flags.has('settled') ? 'settled' : 'midpoint' });

const stills = all.filter((s) => matches(filters, s.name, s.composition));
if (!stills.length) throw new Error(`No beat matched ${filters.join(' ')}`);

await fastStills({
  root,
  entry: 'src/index.tsx',
  outDir: values.out ?? (theme === 'light' ? 'out/stills' : `out/stills-${theme}`),
  stills,
  props: { theme },
  width: timeline.width,
  height: timeline.height,
  force: flags.has('force'),
  // A correction to one segment's drawing costs that segment, not the set.
  ownSourceDir: 'src/segments',
  ownSourceOf: (s) => `src/segments/${s.segment}.tsx`,
});
