// Tiles a stills directory into a single contact sheet for review.
//
// One image beats thirty-six: it embeds in a pull request comment as one
// picture a reviewer takes in at a glance, and it is one upload instead of
// thirty-six. Names are printed to stdout in reading order rather than drawn
// onto the sheet, so this needs no font file on the runner.
//
//   node node_modules/rendiv-kit/node/contact-sheet.mjs
//   node node_modules/rendiv-kit/node/contact-sheet.mjs --dir out/stills-dark --cols 4
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ffmpegPath, parseArgs } from './rendiv.mjs';
import { isMain } from './is-main.mjs';

export function contactSheet({
  root,
  stillsDir = 'out/stills',
  out = 'out/contact-sheet.png',
  cols = 3,
  tileWidth = 640,
  log = console.log,
}) {
  const stills = path.resolve(root, stillsDir);
  if (!fs.existsSync(stills)) throw new Error(`No stills directory at ${stillsDir}`);

  const files = fs.readdirSync(stills).filter((f) => f.endsWith('.png')).sort();
  if (!files.length) throw new Error(`No stills in ${stillsDir}; render them first`);

  // `tile` works on one sequential stream, so the stills are staged as
  // 001.png, 002.png and so on. Their real names carry the order already,
  // which is why they are numbered at the source.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rendiv-sheet-'));
  try {
    files.forEach((f, i) =>
      fs.copyFileSync(path.join(stills, f), path.join(tmp, `${String(i + 1).padStart(3, '0')}.png`)),
    );

    const rows = Math.ceil(files.length / cols);
    const outAbs = path.resolve(root, out);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });

    execFileSync(ffmpegPath(root), [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', path.join(tmp, '%03d.png'),
      '-vf', `scale=${tileWidth}:-1,tile=${cols}x${rows}:padding=8:margin=8:color=white`,
      '-frames:v', '1',
      outAbs,
    ]);

    const mb = (fs.statSync(outAbs).size / 1024 / 1024).toFixed(2);
    log(`contact sheet: ${files.length} stills, ${cols}x${rows}, ${mb} MB -> ${out}`);
    log(files.map((f, i) => `${i + 1}. ${f.replace('.png', '')}`).join('\n'));
    return { file: outAbs, count: files.length, cols, rows };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs(process.argv.slice(2), ['dir', 'out', 'cols', 'width']);
  contactSheet({
    root: process.cwd(),
    stillsDir: values.dir ?? 'out/stills',
    out: values.out ?? 'out/contact-sheet.png',
    cols: values.cols ? Number(values.cols) : 3,
    tileWidth: values.width ? Number(values.width) : 640,
  });
}
