// A project palette against the kit's token contract.
//
// The kit components reach for a fixed set of names. A palette that omits one
// does not fail at build time; it fails at render time, in one scene, as an
// `undefined` that CSS drops silently and that looks like a colour nobody
// chose. This is that failure moved forward to a check.
//
// The required lists come from src/theme-contract.json, which is also what the
// TypeScript types mirror.
//
//   node node_modules/rendiv-kit/node/checks/theme.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { at, loadConfig, report } from '../config.mjs';
import { numberFrom, readPalettes, typeTiersFrom } from '../theme-source.mjs';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const contract = () =>
  JSON.parse(fs.readFileSync(path.join(kitRoot, 'src', 'theme-contract.json'), 'utf-8'));

export function runTheme(config) {
  const c = contract();
  const problems = [];
  const themeFile = at(config, config.themeSource);
  const { palettes, missing, source } = readPalettes(themeFile, config.palettes);

  for (const name of missing) {
    problems.push(`${config.themeSource} holds no palette named ${name}`);
  }

  // Every palette carries every required colour. Checked per palette rather
  // than once, because a dark cut that forgot a token is exactly the case that
  // renders successfully and looks wrong only on one surface.
  for (const [name, palette] of Object.entries(palettes)) {
    for (const token of c.colors.required) {
      if (!palette[token]) {
        problems.push(`${name} is missing the required colour "${token}"`);
      }
    }
  }

  // The palettes must agree with each other. A token in one and not the other
  // is a scene that draws in one cut and not in the other.
  const names = Object.keys(palettes);
  if (names.length > 1) {
    const [first, ...rest] = names;
    for (const other of rest) {
      for (const token of Object.keys(palettes[first])) {
        if (!palettes[other][token]) {
          problems.push(`${other} is missing "${token}", which ${first} declares`);
        }
      }
      for (const token of Object.keys(palettes[other])) {
        if (!palettes[first][token]) {
          problems.push(`${first} is missing "${token}", which ${other} declares`);
        }
      }
    }
  }

  const tiers = new Set(typeTiersFrom(source).map((t) => t.name));
  for (const tier of c.type.required) {
    if (!tiers.has(tier)) problems.push(`the type scale declares no required tier "${tier}"`);
  }

  for (const key of c.layout.required) {
    if (numberFrom(source, key) === undefined) {
      problems.push(`the layout declares no "${key}"`);
    }
  }

  for (const key of c.fonts.required) {
    if (!new RegExp(`\\b${key}:\\s*['"\`]`).test(source)) {
      problems.push(`the font stack declares no "${key}"`);
    }
  }

  return {
    problems,
    summary:
      `${names.length} palettes carry all ${c.colors.required.length} required colours, ` +
      `${c.type.required.length} required type tiers, ${c.layout.required.length} layout keys`,
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const config = loadConfig(process.cwd());
  const { problems, summary } = runTheme(config);
  report('theme check', problems, summary);
}
