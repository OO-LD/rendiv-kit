import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { matches, parseArgs } from './rendiv.mjs';
import { stalenessCheck } from './fast-stills.mjs';
import {
  beatFrames,
  sampleFrame,
  segmentLength,
  settledFrame,
  settledSampleFrame,
  stillName,
  stillsFromTimeline,
  settledStillsFromTimeline,
} from './beats.mjs';

test('parseArgs separates flag values from positional filters', () => {
  const r = parseArgs(['--theme', 'dark', 's09', '--force', 's12'], ['theme', 'out']);
  assert.equal(r.values.theme, 'dark');
  assert.equal(r.values.out, undefined);
  assert.deepEqual(r.filters, ['s09', 's12']);
  assert.ok(r.flags.has('force'));
  assert.ok(r.flags.has('theme'));
});

test('parseArgs does not mistake a flag value for a filter', () => {
  // Without valueFlags, "dark" is indistinguishable from a composition name.
  const bare = parseArgs(['--theme', 'dark']);
  assert.deepEqual(bare.filters, ['dark']);
  const declared = parseArgs(['--theme', 'dark'], ['theme']);
  assert.deepEqual(declared.filters, []);
});

test('matches is permissive with no filter and substring-matches names', () => {
  assert.ok(matches([], 'anything', 'X1'));
  assert.ok(matches(['intro'], '01-intro-title', 'S1'));
  assert.ok(matches(['S1'], '01-intro-title', 'S1'), 'id matches exactly');
  assert.ok(!matches(['S1'], '01-intro-title', 'S2'));
  assert.ok(!matches(['outro'], '01-intro-title', 'S1'));
});

const TIMELINE = {
  fps: 30,
  segments: [
    { id: 'S1', beats: [{ name: 'a', len: 90 }, { name: 'b', len: 60, clip: true }] },
    { id: 'S2', beats: [{ name: 'c', len: 120, still: 10 }] },
  ],
};

test('beatFrames accumulates local start frames', () => {
  const b = beatFrames(TIMELINE.segments[0]);
  assert.deepEqual(
    b.map(({ name, start, len, clip }) => ({ name, start, len, clip })),
    [
      { name: 'a', start: 0, len: 90, clip: false },
      { name: 'b', start: 90, len: 60, clip: true },
    ],
  );
});

test('beatFrames rejects a beat with no length', () => {
  assert.throws(
    () => beatFrames({ id: 'S9', beats: [{ name: 'x' }] }),
    /S9\.x declares no len/,
  );
});

test('segmentLength and settledFrame back off the final frame', () => {
  assert.equal(segmentLength(TIMELINE.segments[0]), 150);
  assert.equal(settledFrame(TIMELINE.segments[0]), 138);
  // A segment shorter than the tail must not produce a negative frame.
  assert.equal(settledFrame({ beats: [{ name: 'x', len: 4 }] }), 0);
});

test('sampleFrame takes the midpoint, or the declared override', () => {
  const [a, b] = beatFrames(TIMELINE.segments[0]);
  assert.equal(sampleFrame(a), 45);
  assert.equal(sampleFrame(b), 120, 'offset by the beat start');
  const [c] = beatFrames(TIMELINE.segments[1]);
  assert.equal(sampleFrame(c), 10, 'the declared still wins over the midpoint');
});

test('settledSampleFrame lands inside its own beat', () => {
  const [, b] = beatFrames(TIMELINE.segments[0]);
  assert.equal(settledSampleFrame(b), 138);
  assert.ok(settledSampleFrame(b) >= b.start, 'never before the beat opens');
  const short = { start: 100, len: 5, beat: {} };
  assert.equal(settledSampleFrame(short), 100, 'a beat shorter than the tail clamps to its start');
});

test('stillName is stable and lowercase', () => {
  assert.equal(stillName('S1', 'a'), 's1-a');
  assert.equal(stillName('S1'), 's1-settled');
});

test('stillsFromTimeline yields one still per beat, carrying the clip flag', () => {
  const s = stillsFromTimeline(TIMELINE);
  assert.equal(s.length, 3, 'three beats, three stills');
  assert.deepEqual(s.map((x) => x.name), ['s1-a', 's1-b', 's2-c']);
  assert.deepEqual(s.map((x) => x.frame), [45, 120, 10]);
  assert.deepEqual(s.map((x) => x.composition), ['S1', 'S1', 'S2']);
  assert.equal(s[1].clip, true);
});

test('settledStillsFromTimeline collapses to one per segment', () => {
  const s = settledStillsFromTimeline(TIMELINE);
  assert.equal(s.length, 2, 'two segments, two stills: the lossy export');
  assert.deepEqual(s.map((x) => x.name), ['s1-settled', 's2-settled']);
  assert.equal(s[0].clip, true, 'a segment holding a clip beat still wants video');
});

const tmpProject = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rendiv-kit-test-'));
  fs.mkdirSync(path.join(root, 'src', 'segments'), { recursive: true });
  fs.mkdirSync(path.join(root, 'out'), { recursive: true });
  return root;
};

const write = (root, rel, body = 'x') => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
};

const touch = (file, msFromNow) => {
  const t = new Date(Date.now() + msFromNow);
  fs.utimesSync(file, t, t);
};

test('stalenessCheck: a missing output is always stale', () => {
  const root = tmpProject();
  write(root, 'src/theme.ts');
  const isStale = stalenessCheck({ root });
  assert.ok(isStale({ name: 'a' }, path.join(root, 'out/a.png')));
});

test('stalenessCheck: a newer shared source invalidates every still', () => {
  const root = tmpProject();
  const theme = write(root, 'src/theme.ts');
  const png = write(root, 'out/a.png');
  touch(png, -10_000);
  touch(theme, -20_000);
  assert.ok(!stalenessCheck({ root })({ name: 'a' }, png), 'older source, still is current');

  touch(theme, 10_000);
  assert.ok(stalenessCheck({ root })({ name: 'a' }, png), 'newer source, still is stale');
});

test('stalenessCheck: a per-still source is charged only to its own still', () => {
  const root = tmpProject();
  const shared = write(root, 'src/theme.ts');
  const own = write(root, 'src/segments/S1.tsx');
  const other = write(root, 'src/segments/S2.tsx');
  const pngA = write(root, 'out/a.png');
  const pngB = write(root, 'out/b.png');

  for (const f of [shared, own, other]) touch(f, -20_000);
  for (const f of [pngA, pngB]) touch(f, -10_000);

  // Only S1's own drawing changed.
  touch(own, 10_000);

  const isStale = stalenessCheck({
    root,
    ownSourceDir: 'src/segments',
    ownSourceOf: (s) => `src/segments/${s.segment}.tsx`,
  });
  assert.ok(isStale({ name: 'a', segment: 'S1' }, pngA), 'the edited drawing rebuilds');
  assert.ok(!isStale({ name: 'b', segment: 'S2' }, pngB), 'its neighbour does not');
});

test('stalenessCheck: a per-still source that vanished does not pin the still dirty', () => {
  const root = tmpProject();
  const shared = write(root, 'src/theme.ts');
  const png = write(root, 'out/a.png');
  touch(shared, -20_000);
  touch(png, -10_000);

  const isStale = stalenessCheck({
    root,
    ownSourceDir: 'src/segments',
    ownSourceOf: () => 'src/segments/gone.tsx',
  });
  assert.ok(!isStale({ name: 'a' }, png), 'a missing own source is not an infinite mtime');
});

test('stalenessCheck: force overrides everything', () => {
  const root = tmpProject();
  write(root, 'src/theme.ts');
  const png = write(root, 'out/a.png');
  touch(png, 60_000);
  assert.ok(stalenessCheck({ root, force: true })({ name: 'a' }, png));
});
