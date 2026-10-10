// Does any slide's content run into the chrome?
//
// The top of a board is furniture: a rail, a title band. Content starts below
// it, and the gutter between the two is a band nothing is allowed to draw in. A
// beat taller than its band does not clip, it overlaps, and on a projector that
// reads as one heading on top of another.
//
// This is the one check that needs rendered stills rather than source, because
// where a block actually lands is a layout result and not a number anyone wrote
// down.
//
// The band is measured with ffmpeg rather than a PNG decoder: ffmpeg is already
// a dependency of every project here, and `signalstats` over a crop answers the
// question directly. A gutter holding only the background is flat, so its
// luma spread is near zero; anything drawn into it opens that spread.
//
//   node node_modules/rendiv-kit/node/checks/stills.mjs
//   node node_modules/rendiv-kit/node/checks/stills.mjs --only s09,s12
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { at, loadConfig, parseOnly, report } from '../config.mjs';
import { isMain } from '../is-main.mjs';
import { ffmpegPath } from '../rendiv.mjs';

/** Luma spread across a crop. A flat band reads near 0. */
export function lumaSpread(ffmpeg, file, crop) {
  const r = spawnSync(
    ffmpeg,
    [
      '-hide_banner', '-loglevel', 'info',
      '-i', file,
      '-vf', `crop=${crop},signalstats`,
      '-f', 'null', '-',
    ],
    { encoding: 'utf-8' },
  );
  const text = r.stderr ?? '';
  const min = text.match(/YMIN:(\d+)/);
  const max = text.match(/YMAX:(\d+)/);
  if (!min || !max) {
    throw new Error(`ffmpeg reported no signalstats for ${path.basename(file)}`);
  }
  return Number(max[1]) - Number(min[1]);
}

export function runStills(config, only = []) {
  const s = config.stills;
  if (s.titleBandBottom === null || s.contentTop === null) {
    return {
      problems: [],
      summary: 'no gutter declared in stills.titleBandBottom / stills.contentTop, skipped',
    };
  }
  const height = s.contentTop - s.titleBandBottom;
  if (height <= 0) {
    return {
      problems: [`contentTop ${s.contentTop} is not below titleBandBottom ${s.titleBandBottom}`],
      summary: '',
    };
  }

  const dir = at(config, config.stillsDir);
  if (!fs.existsSync(dir)) {
    return { problems: [`no stills in ${config.stillsDir}; render them first`], summary: '' };
  }
  let files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
  if (only.length) {
    files = files.filter((f) => only.some((o) => f.toLowerCase().includes(o.toLowerCase())));
    if (!files.length) {
      return { problems: [`--only ${only.join(',')} matched no still in ${config.stillsDir}`], summary: '' };
    }
  }
  if (!files.length) {
    return { problems: [`${config.stillsDir} holds no PNGs`], summary: '' };
  }

  const ffmpeg = ffmpegPath(config.root);
  const tolerance = s.spreadTolerance ?? 6;
  const width = s.width ?? 1920;
  const padX = s.padX ?? 0;
  const crop = `${width - padX * 2}:${height}:${padX}:${s.titleBandBottom}`;

  const problems = [];
  for (const f of files) {
    const spread = lumaSpread(ffmpeg, path.join(dir, f), crop);
    if (spread > tolerance) {
      problems.push(
        `${f} draws into the gutter at y ${s.titleBandBottom} to ${s.contentTop}: ` +
          `luma spread ${spread}, over the ${tolerance} a flat band allows. ` +
          'The block above the content is overlapping the chrome.',
      );
    }
  }

  return {
    problems,
    summary: `${files.length} stills, gutter y ${s.titleBandBottom}-${s.contentTop} clear`,
  };
}

if (isMain(import.meta.url)) {
  const config = loadConfig(process.cwd());
  const { problems, summary } = runStills(config, parseOnly(process.argv.slice(2)));
  report('stills check', problems, summary);
}
