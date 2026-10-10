// The beat list, derived from a timeline file rather than maintained beside it.
//
// A hand-written list of frame numbers goes stale the first time a segment is
// retimed, and the beat it stops covering is exactly the one nobody looks at
// again. The same file drives the compositions, the still driver, the checks and
// the deck export, so none of them can end up in a different order from the
// others.
//
// The contract, which is all the kit requires of it:
//
//   {
//     "fps": 30,
//     "width": 1920,
//     "height": 1080,
//     "segments": [
//       { "id": "S1", "beats": [
//         { "name": "opening", "len": 90 },
//         { "name": "claim",   "len": 120, "clip": true, "still": 40 }
//       ] }
//     ]
//   }
//
// `clip` marks a beat whose evidence is the motion, so an export that can hold
// video plays it instead of showing a frame. `still` overrides where the beat is
// sampled; the default midpoint of a beat playing twenty seconds of screen
// recording is wherever the recording happens to be.
import fs from 'node:fs';
import path from 'node:path';

export function loadTimeline(root, file = 'src/timeline.json') {
  const p = path.resolve(root, file);
  if (!fs.existsSync(p)) throw new Error(`No timeline at ${p}`);
  const tl = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (!Array.isArray(tl.segments)) throw new Error(`${file} declares no segments array`);
  if (!tl.fps) throw new Error(`${file} declares no fps`);
  return tl;
}

// (name, local start frame, length, plays a clip), in order within the segment.
export function beatFrames(segment) {
  const out = [];
  let cursor = 0;
  for (const beat of segment.beats ?? []) {
    if (typeof beat.len !== 'number') {
      throw new Error(`${segment.id}.${beat.name ?? '?'} declares no len`);
    }
    out.push({ name: beat.name, start: cursor, len: beat.len, clip: Boolean(beat.clip), beat });
    cursor += beat.len;
  }
  return out;
}

export const segmentLength = (segment) =>
  (segment.beats ?? []).reduce((total, b) => total + b.len, 0);

// The frame where a segment has finished building: the last beat, a little
// before its end rather than on it. Seeking to the final frame of a composition
// is the one seek that tends to come back empty.
export const settledFrame = (segment, tail = 12) => Math.max(0, segmentLength(segment) - tail);

// Where a beat is sampled for a still. The midpoint is past every entry
// animation and before the next cut; `still` in the timeline overrides it, as an
// offset from the beat's own start.
export const sampleFrame = (b) =>
  b.start + (typeof b.beat?.still === 'number' ? b.beat.still : Math.floor(b.len / 2));

// `settled` samples the end of a beat instead of its middle, which is what a
// deck export wants: the slide as the room sees it once it has finished drawing.
export const settledSampleFrame = (b, tail = 12) => b.start + Math.max(0, b.len - tail);

export const stillName = (segmentId, beatName) =>
  beatName ? `${segmentId.toLowerCase()}-${beatName}` : `${segmentId.toLowerCase()}-settled`;

/**
 * Every beat as a still request for fastStills.
 *
 * @param {object} timeline
 * @param {object} [o]
 * @param {'midpoint'|'settled'} [o.sample] where in the beat to sample
 * @param {number} [o.tail] frames before the end that `settled` backs off by
 */
export function stillsFromTimeline(timeline, { sample = 'midpoint', tail = 12 } = {}) {
  const frameOf = sample === 'settled' ? (b) => settledSampleFrame(b, tail) : sampleFrame;
  return timeline.segments.flatMap((seg) =>
    beatFrames(seg).map((b) => ({
      name: stillName(seg.id, b.name),
      composition: seg.id,
      frame: frameOf(b),
      segment: seg.id,
      beat: b.name,
      clip: b.clip,
    })),
  );
}

// One still per segment, in its settled state. Loses any beat that replaces its
// predecessor rather than adding to it, which is why it is not the default
// anywhere.
export function settledStillsFromTimeline(timeline, { tail = 12 } = {}) {
  return timeline.segments.map((seg) => ({
    name: stillName(seg.id),
    composition: seg.id,
    frame: settledFrame(seg, tail),
    segment: seg.id,
    beat: null,
    clip: (seg.beats ?? []).some((b) => b.clip),
  }));
}
