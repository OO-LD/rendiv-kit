import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkPalette, contrast, luminance, rgb } from './checks/contrast.mjs';
import { restates } from './checks/titles.mjs';
import { shingles } from './checks/novelty.mjs';
import { DEFAULTS, parseOnly } from './config.mjs';
import { numberFrom, paletteFrom, typeTiersFrom } from './theme-source.mjs';

// Against the specification's own values, not against this implementation.
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
test('luminance matches the WCAG reference points', () => {
  assert.equal(luminance('#000000'), 0);
  assert.equal(luminance('#ffffff'), 1);
  assert.ok(Math.abs(luminance('#808080') - 0.2158) < 0.001);
});

test('contrast is the WCAG ratio and is symmetric', () => {
  assert.equal(contrast('#000000', '#ffffff'), 21);
  assert.equal(contrast('#ffffff', '#000000'), 21);
  assert.equal(contrast('#777777', '#777777'), 1);
  // The canonical "just passes AA" grey on white.
  assert.ok(contrast('#767676', '#ffffff') >= 4.5);
  assert.ok(contrast('#777777', '#ffffff') < 4.5);
});

test('rgb takes the three hex spellings and rejects the rest', () => {
  assert.deepEqual(rgb('#fff'), [255, 255, 255]);
  assert.deepEqual(rgb('#ff0000'), [255, 0, 0]);
  assert.deepEqual(rgb('#ff000080'), [255, 0, 0], 'alpha ignored');
  assert.throws(() => rgb('rebeccapurple'), /Not a hex colour/);
});

const PALETTE_ARGS = {
  surfaces: ['bg', 'panel'],
  bodyTokens: ['ink', 'muted'],
  graphicTokens: ['hairline'],
  minRatio: 4.5,
  minRatioGraphic: 3,
};

test('checkPalette passes a palette that clears both floors', () => {
  const r = checkPalette({
    name: 'LIGHT',
    palette: {
      bg: '#ffffff',
      panel: '#ffffff',
      ink: '#111111',
      muted: '#595959',
      hairline: '#949494',
    },
    ...PALETTE_ARGS,
  });
  assert.deepEqual(r.problems, []);
  assert.equal(r.measured, 6, 'three tokens against two surfaces');
});

test('checkPalette names the pair and the measurement when a token is too faint', () => {
  const r = checkPalette({
    name: 'LIGHT',
    palette: { bg: '#ffffff', panel: '#ffffff', ink: '#111111', muted: '#bbbbbb', hairline: '#949494' },
    ...PALETTE_ARGS,
  });
  assert.equal(r.problems.length, 2, 'muted fails on both surfaces');
  assert.match(r.problems[0], /LIGHT\.muted #bbbbbb on bg #ffffff measures 1\.\d+:1, under the 4\.5:1 text floor/);
});

test('checkPalette treats an undeclared token as a failure, not a skip', () => {
  const r = checkPalette({
    name: 'DARK',
    palette: { bg: '#000000', panel: '#000000', ink: '#ffffff', hairline: '#888888' },
    ...PALETTE_ARGS,
  });
  assert.ok(
    r.problems.some((p) => /declares no token muted, so nothing was measured/.test(p)),
    'a token nobody measured must not pass quietly',
  );
});

test('checkPalette holds drawn objects to the lower graphic floor', () => {
  // 3.2:1 against white: too faint for text, acceptable for a rule.
  const palette = { bg: '#ffffff', panel: '#ffffff', ink: '#111111', muted: '#595959', hairline: '#919191' };
  const r = checkPalette({ name: 'LIGHT', palette, ...PALETTE_ARGS });
  assert.deepEqual(r.problems, [], 'hairline passes at 3:1');

  const asText = checkPalette({
    name: 'LIGHT',
    palette,
    ...PALETTE_ARGS,
    bodyTokens: ['hairline'],
    graphicTokens: [],
  });
  assert.equal(asText.problems.length, 2, 'the same colour fails the text floor');
});

test('restates catches a kicker that repeats its section name', () => {
  assert.ok(restates('Narrowing', 'Narrowing'), 'exact');
  assert.ok(restates('narrowing', 'Narrowing'), 'case does not save it');
  assert.ok(restates('Narrowing', 'Narrowing: the class fix'), 'the leading clause counts');
  assert.ok(restates('the class', 'The class fixes units'), 'a subset of the words counts');
});

test('restates passes a kicker that adds words of its own', () => {
  assert.ok(!restates('class fixes units', 'Narrowing'));
  assert.ok(!restates('what it costs', 'Narrowing: the class fix'));
  assert.ok(!restates('', 'Narrowing'), 'an empty kicker is not a repeat');
});

test('shingles indexes every run of n words and keeps the first source', () => {
  const s = shingles([{ text: 'one two three four', where: 'a.ts' }], 3);
  assert.deepEqual([...s.keys()], ['one two three', 'two three four']);
  assert.equal(s.get('one two three'), 'a.ts');
  assert.equal(shingles([{ text: 'one two', where: 'a.ts' }], 3).size, 0, 'too short to shingle');
});

test('parseOnly splits a comma list and tolerates its absence', () => {
  assert.deepEqual(parseOnly(['--only', 's09,s12']), ['s09', 's12']);
  assert.deepEqual(parseOnly(['--only', ' s09 , s12 ']), ['s09', 's12']);
  assert.deepEqual(parseOnly([]), []);
  assert.deepEqual(parseOnly(['--only']), []);
});

const THEME_SRC = `
export const STROKE = 2;
const LIGHT = {
  bg: '#ffffff',
  ink: '#111111',
  accent: '#0b6',
};
const DARK = {
  bg: '#000000',
  ink: '#ffffff',
  accent: '#3fd',
};
export const type = {
  headline: { size: 68, weight: 800, leading: 1.2 },
  body: { size: 28, weight: 500 },
};
export const layout = { padX: 96, padY: 72 };
`;

test('paletteFrom reads a palette and returns null for one that is absent', () => {
  assert.deepEqual(paletteFrom(THEME_SRC, 'LIGHT'), {
    bg: '#ffffff',
    ink: '#111111',
    accent: '#0b6',
  });
  assert.equal(paletteFrom(THEME_SRC, 'SEPIA'), null, 'absent, so the caller can say which');
});

test('numberFrom reads an object key and a bare const', () => {
  assert.equal(numberFrom(THEME_SRC, 'padX'), 96);
  assert.equal(numberFrom(THEME_SRC, 'STROKE'), 2);
  assert.equal(numberFrom(THEME_SRC, 'padZ'), undefined, 'absent rather than guessed');
});

test('typeTiersFrom lists the scale', () => {
  assert.deepEqual(typeTiersFrom(THEME_SRC), [
    { name: 'headline', size: 68 },
    { name: 'body', size: 28 },
  ]);
});

test('the shipped defaults are defensible thresholds, not placeholders', () => {
  assert.equal(DEFAULTS.a11y.minRatio, 4.5, 'WCAG AA for text');
  assert.equal(DEFAULTS.a11y.minRatioGraphic, 3, 'WCAG AA for graphical objects');
  assert.ok(DEFAULTS.a11y.minSize >= 24);
  assert.ok(DEFAULTS.a11y.surfaces.includes('bg') && DEFAULTS.a11y.surfaces.includes('panel'));
});
