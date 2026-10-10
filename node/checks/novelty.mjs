// This deck against a prior one it must not have reused sentences from.
//
// A rewrite that quietly reuses whole clauses from the version it replaces is
// not a rewrite; it is the old thing with new section names, and nobody
// reviewing a diff of two unrelated directories would notice.
//
// Every string literal in this project's source is compared against every
// string literal in the directory named by `novelty.against`, and any shared
// run of `novelty.words` or more words is a failure. Six is short enough to
// catch a reused clause and long enough that ordinary English does not trip it.
//
//   node node_modules/rendiv-kit/node/checks/novelty.mjs
import fs from 'node:fs';
import { at, loadConfig, readJson, relTo, report, walk } from '../config.mjs';
import { isMain } from '../is-main.mjs';

const words = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Every literal, with where it came from. */
export function literals(dir, root) {
  const out = [];
  for (const file of walk(dir, /\.(tsx?|json)$/)) {
    const text = fs.readFileSync(file, 'utf-8');
    const where = relTo(root, file);
    for (const m of text.matchAll(/'([^'\\\n]{12,})'|"([^"\\\n]{12,})"|`([^`\\]{12,})`/g)) {
      out.push({ text: m[1] ?? m[2] ?? m[3], where });
    }
  }
  return out;
}

/** Every run of exactly n words, as a lookup from the phrase to where it was. */
export function shingles(items, n) {
  const map = new Map();
  for (const item of items) {
    const w = words(item.text);
    for (let i = 0; i + n <= w.length; i += 1) {
      const key = w.slice(i, i + n).join(' ');
      if (!map.has(key)) map.set(key, item.where);
    }
  }
  return map;
}

export function runNovelty(config) {
  const n = config.novelty;
  const againstDir = at(config, n.against);
  if (!againstDir) {
    return { problems: [], summary: 'no prior deck configured, nothing to compare against' };
  }
  if (!fs.existsSync(againstDir)) {
    return {
      problems: [
        `novelty.against points at ${n.against}, which does not exist. ` +
          'Nothing was compared, so this check proved nothing.',
      ],
      summary: '',
    };
  }

  const allow = new Set(readJson(at(config, n.allow), []).map((s) => words(s).join(' ')));
  const mine = literals(at(config, config.srcDir), config.root);
  const theirs = shingles(literals(againstDir, againstDir), n.words);

  const problems = [];
  const seen = new Set();
  for (const item of mine) {
    const w = words(item.text);
    for (let i = 0; i + n.words <= w.length; i += 1) {
      const key = w.slice(i, i + n.words).join(' ');
      if (!theirs.has(key) || allow.has(key) || seen.has(key)) continue;
      seen.add(key);
      problems.push(
        `${item.where} reuses "${key}" from ${theirs.get(key)}. ` +
          'Rewrite it, or add the phrase to the allow list.',
      );
    }
  }

  return {
    problems,
    summary:
      `${mine.length} literals against ${theirs.size} ${n.words}-word runs in ${n.against}, ` +
      `${allow.size} allowed`,
  };
}

if (isMain(import.meta.url)) {
  const config = loadConfig(process.cwd());
  const { problems, summary } = runNovelty(config);
  report('novelty check', problems, summary);
}
