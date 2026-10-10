// Reading a project's palettes out of its theme module, without running it.
//
// The checks are static: they must work on a checkout, before a bundle exists
// and without a browser. A theme written in TypeScript cannot simply be
// imported from a .mjs script, so the palettes are scraped from the source.
//
// That is a deliberate limitation rather than a shortcut. The scraper only
// understands a palette written as object literals of hex strings, which is how
// every project in the collection wrote one. Anything computed is invisible to
// it, so `missingTokens` reports what it could not find instead of passing
// quietly: a check that silently measured nothing is the failure mode these
// checks exist to catch.
//
// A project that outgrows this emits its palettes as JSON and points
// `palettesFile` at it.
import fs from 'node:fs';

const HEX = /([A-Za-z_][\w]*):\s*'(#[0-9A-Fa-f]{3,8})'/g;

/**
 * One named palette: `const LIGHT = { ... }` or `export const LIGHT = { ... }`.
 * Returns null when the name is absent, so the caller can say which.
 */
export function paletteFrom(source, name) {
  const head = source.search(new RegExp(`(?:export\\s+)?const\\s+${name}\\b`));
  if (head < 0) return null;
  const end = source.indexOf('\n};', head);
  const body = source.slice(head, end < 0 ? source.length : end);
  const out = {};
  for (const m of body.matchAll(HEX)) out[m[1]] = m[2];
  return Object.keys(out).length ? out : null;
}

export function readPalettes(themeFile, names) {
  const source = fs.readFileSync(themeFile, 'utf-8');
  const found = {};
  const missing = [];
  for (const name of names) {
    const p = paletteFrom(source, name);
    if (p) found[name] = p;
    else missing.push(name);
  }
  return { palettes: found, missing, source };
}

/** `padX: 96` and friends. Returns undefined rather than guessing. */
export function numberFrom(source, name) {
  const m = source.match(new RegExp(`\\b${name}:\\s*(\\d+(?:\\.\\d+)?)\\b`));
  if (m) return Number(m[1]);
  const c = source.match(new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*(\\d+(?:\\.\\d+)?)`));
  return c ? Number(c[1]) : undefined;
}

/** Every `name: { size: N ... }` in a type scale, as [name, size, leading?]. */
export function typeTiersFrom(source) {
  const out = [];
  for (const m of source.matchAll(/(\w+):\s*\{[^}]*\bsize:\s*(\d+)/g)) {
    out.push({ name: m[1], size: Number(m[2]) });
  }
  return out;
}
