// Renders a set of sibling projects in a declared order, and optionally stitches
// a merged cut from some of them.
//
// The order is the project owner's, not a property of the filesystem: the one
// that is wanted first is rendered first, because the first cut is usually
// needed before any of the others exist. So it is declared in a queue file
// rather than derived from directory names.
//
//   node node_modules/rendiv-kit/node/render-queue.mjs
//   node node_modules/rendiv-kit/node/render-queue.mjs --queue render-queue.json --variant dark
//
// render-queue.json, beside the directory holding the projects:
//
//   {
//     "order": ["b", "a", "c"],
//     "command": "npm run render --",
//     "variants": { "": [], "dark": ["--theme", "dark"] },
//     "merge": { "of": ["a", "b"], "after": "b", "out": "out/merged{suffix}.mp4" },
//     "outputs": { "a": "out/a{suffix}.mp4" }
//   }
//
// `outputs` names each project's file. Read rather than guessed: one project in
// a set of five named its output differently from the rest, and a guessed name
// silently points at a file that never appears.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ffmpegPath, parseArgs, sizeMB } from './rendiv.mjs';
import { isMain } from './is-main.mjs';

export function loadQueue(root, file = 'render-queue.json') {
  const p = path.resolve(root, file);
  if (!fs.existsSync(p)) throw new Error(`No queue at ${file}`);
  const q = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (!Array.isArray(q.order) || !q.order.length) throw new Error(`${file} declares no order`);
  if (!q.outputs) throw new Error(`${file} declares no outputs map`);
  return q;
}

const expand = (template, suffix) => template.replaceAll('{suffix}', suffix);

export function runQueue({ root, queue, variant = '', log = console.log }) {
  const args = queue.variants?.[variant];
  if (args === undefined) {
    throw new Error(
      `The queue declares no variant "${variant}". It has: ${Object.keys(queue.variants ?? {}).join(', ') || '(none)'}`,
    );
  }
  const suffix = variant ? `-${variant}` : '';
  const [cmd, ...base] = (queue.command ?? 'npm run render --').split(/\s+/);

  const outputOf = (project) => {
    const declared = queue.outputs[project];
    if (!declared) throw new Error(`The queue declares no output for ${project}`);
    return path.resolve(root, project, expand(declared, suffix));
  };

  const done = [];
  for (const project of queue.order) {
    const dir = path.resolve(root, project);
    if (!fs.existsSync(dir)) throw new Error(`No project directory ${project}`);
    process.stdout.write(`${project}${suffix} ... `);
    const started = Date.now();
    execFileSync(cmd, [...base, ...args], { cwd: dir, stdio: 'inherit', shell: true });
    const file = outputOf(project);
    if (!fs.existsSync(file)) {
      throw new Error(`${project} reported success but wrote no ${path.relative(root, file)}`);
    }
    log(`ok  ${sizeMB(file)} MB  ${((Date.now() - started) / 1000).toFixed(0)}s`);
    done.push(project);

    if (queue.merge && queue.merge.after === project) {
      merge({ root, queue, suffix, outputOf, log });
    }
  }
  return done;
}

// Story order, not render order: a merged cut plays its parts in the order the
// argument runs, which is rarely the order they were rendered in.
function merge({ root, queue, suffix, outputOf, log }) {
  const parts = queue.merge.of.map(outputOf);
  const missing = parts.filter((p) => !fs.existsSync(p));
  if (missing.length) {
    throw new Error(`cannot merge, missing: ${missing.map((p) => path.relative(root, p)).join(', ')}`);
  }

  const out = path.resolve(root, expand(queue.merge.out, suffix));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const listing = path.join(path.dirname(out), `.concat${suffix}.txt`);
  fs.writeFileSync(listing, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n') + '\n');

  process.stdout.write(`merge ${queue.merge.of.join(' + ')}${suffix} ... `);
  execFileSync(ffmpegPath(root), [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', listing,
    '-c', 'copy', out,
  ]);
  fs.rmSync(listing, { force: true });
  log(`ok  ${sizeMB(out)} MB`);
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs(process.argv.slice(2), ['queue', 'variant']);
  const root = process.cwd();
  const queue = loadQueue(root, values.queue ?? 'render-queue.json');
  runQueue({ root, queue, variant: values.variant ?? '' });
}
