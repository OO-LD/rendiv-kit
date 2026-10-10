// A list of terms that must not reach a slide, against the slide source.
//
// Two kinds of entry, and both are absolute. Numbers that were withdrawn: a
// slide carrying one is a slide saying something that is not true. And internal
// symbols: run ids, flag names and branch names mean something in one
// repository and nothing in a room, so a slide carrying one is a slide the
// audience cannot read.
//
// The list is the project's, in scripts/barred.json:
//
//   [{ "pattern": "\\b0\\.84\\b", "why": "withdrawn with the v1 corpus", "case": false }]
//
//   node node_modules/rendiv-kit/node/checks/barred.mjs
import fs from 'node:fs';
import { at, loadConfig, readJson, relTo, report, walk } from '../config.mjs';

// Source comments are where the reasoning about a barred entry belongs, and an
// entry's own `why` is often repeated there. Scanning them would make the check
// unable to coexist with its own documentation.
const stripComments = (line) => {
  const i = line.indexOf('//');
  return i >= 0 ? line.slice(0, i) : line;
};

export function runBarred(config) {
  const listFile = at(config, config.barred.list);
  const barred = readJson(listFile, []);
  const problems = [];

  for (const entry of barred) {
    if (!entry.pattern) problems.push('an entry has no pattern');
    if (!entry.why?.trim()) problems.push(`entry /${entry.pattern}/ has no why`);
  }

  const files = walk(at(config, config.srcDir), /\.(tsx?|json)$/);
  for (const file of files) {
    const rel = relTo(config.root, file);
    fs.readFileSync(file, 'utf-8')
      .split(/\r?\n/)
      .forEach((raw, i) => {
        const line = stripComments(raw);
        if (!line.trim()) return;
        for (const entry of barred) {
          if (!entry.pattern) continue;
          const m = line.match(new RegExp(entry.pattern, entry.case ? '' : 'i'));
          if (m) {
            problems.push(
              `${rel}:${i + 1} matches /${entry.pattern}/ on "${m[0]}"\n` +
                `      ${entry.why}\n      ${line.trim().slice(0, 140)}`,
            );
          }
        }
      });
  }

  return {
    problems,
    summary: `${barred.length} patterns, none in the slide source across ${files.length} files`,
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const config = loadConfig(process.cwd());
  const { problems, summary } = runBarred(config);
  report('barred check', problems, summary);
}
