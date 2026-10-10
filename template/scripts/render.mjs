// The video, as segments stitched without re-encoding.
//
//   node scripts/render.mjs                every segment, then the stitch
//   node scripts/render.mjs S2             re-render one segment and restitch
//   node scripts/render.mjs --theme dark
//
// Segments must hard-cut. renderSegmented refuses any other overlap, because a
// segment rendered on its own has nothing underneath a cross-dissolve and the
// incoming fade encodes as black at every boundary.
import {
  assertNoBlackFrames,
  loadTimeline,
  parseArgs,
  renderSegmented,
  sizeMB,
} from 'rendiv-kit/node';

const root = process.cwd();
const { values, filters } = parseArgs(process.argv.slice(2), ['theme', 'out']);
const theme = values.theme ?? 'light';
const suffix = theme === 'light' ? '' : `-${theme}`;

const timeline = loadTimeline(root);
const out = values.out ?? `out/video${suffix}.mp4`;

const file = renderSegmented({
  root,
  entry: 'src/index.tsx',
  out,
  // Named by the segment id exactly, because the deck export looks a segment's
  // render up by that id when it slices a beat clip out of it. Lowercasing here
  // resolves on Windows and fails on a case-sensitive filesystem.
  segments: timeline.segments.map((s) => ({ name: s.id, id: s.id })),
  overlap: 0,
  segmentDir: `out/segments${suffix}`,
  props: { theme },
  filters,
});

// The failure renderSegmented is built to avoid, checked rather than assumed.
assertNoBlackFrames(root, file);
console.log(`\n${out}  ${sizeMB(file)} MB`);
