// A kicker that repeats its own section name.
//
// The section name is furniture drawn by the slide chrome, at a fixed place, in
// a size no board is allowed to compete with. A board that also prints that name
// as its kicker puts the same words on screen twice, forty pixels apart, and the
// room reads the smaller one as a second heading.
//
// Fails when a kicker repeats its section name, or the leading clause of it. The
// test is on words, not characters: "narrowing" against "Narrowing" has to fail,
// while "class fixes units" against "Narrowing" passes.
//
// Kickers come from the deck's own stages, or from a JSON map named by
// `titles.kickers`. The map form is checked for coverage first: the
// implementation this was adapted from scanned copy modules by indentation,
// found 13 of 50 kickers, and reported a clean run. A check nobody can trust is
// worse than no check, so a stage the map does not cover is a failure rather
// than a skip.
//
//   node node_modules/rendiv-kit/node/checks/titles.mjs
import fs from 'node:fs';
import { at, loadConfig, readJson, report } from '../config.mjs';
import { typeTiersFrom } from '../theme-source.mjs';

const words = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** The leading clause, before any colon. */
const head = (title) => words(title.split(':')[0]).join(' ');

export function restates(kicker, title) {
  const kw = words(kicker);
  if (!kw.length) return false;
  const titleWords = new Set(words(title));
  return kw.join(' ') === head(title) || kw.every((w) => titleWords.has(w));
}

export function runTitles(config) {
  const problems = [];
  const deckFile = at(config, config.deck);
  if (!deckFile || !fs.existsSync(deckFile)) {
    return { problems: [`no deck at ${config.deck}; set "deck" in rendiv.config.json`], summary: '' };
  }
  const deck = readJson(deckFile);

  const mapFile = at(config, config.titles?.kickers);
  const fromMap = mapFile ? readJson(mapFile) : null;

  const kickerOf = (slide, stage) =>
    fromMap ? fromMap[`${slide.id}.${stage.name}`] : stage.kicker;

  // Coverage first, and only for the map form: a stage missing from a declared
  // map means the map has lost track of it, and every later result is suspect.
  if (fromMap) {
    const uncovered = [];
    for (const slide of deck.slides) {
      for (const stage of slide.stages ?? []) {
        if (!(`${slide.id}.${stage.name}` in fromMap)) {
          uncovered.push(`${slide.id}.${stage.name}`);
        }
      }
    }
    if (uncovered.length) {
      return {
        problems: [
          `${uncovered.length} stage(s) declared in the deck are absent from ` +
            `${config.titles.kickers}. The map has lost track of them; fix it rather ` +
            `than trusting the result.\n      ${uncovered.join(', ')}`,
        ],
        summary: '',
      };
    }
  }

  let counted = 0;
  for (const slide of deck.slides) {
    if (!slide.title) continue;
    for (const stage of slide.stages ?? []) {
      const kicker = kickerOf(slide, stage);
      if (!kicker) continue;
      counted += 1;
      if (restates(kicker, slide.title)) {
        problems.push(
          `${slide.id}.${stage.name}: kicker "${kicker}" restates the section name ` +
            `"${slide.title}"`,
        );
      }
    }
  }

  // Read rather than written down, so the number in the advice cannot drift
  // away from the type scale.
  let titleSize = '?';
  const themeFile = at(config, config.themeSource);
  if (fs.existsSync(themeFile)) {
    const tier = typeTiersFrom(fs.readFileSync(themeFile, 'utf-8')).find((t) => t.name === 'title');
    if (tier) titleSize = String(tier.size);
  }
  if (problems.length) {
    problems.push(
      `Drop the kicker, or give it words the section name does not have. ` +
        `The name is already on screen at ${titleSize}px.`,
    );
  }

  return {
    problems,
    summary:
      `${deck.slides.filter((s) => s.title).length} section names, ${counted} kickers, ` +
      'no kicker repeats one',
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const config = loadConfig(process.cwd());
  const { problems, summary } = runTitles(config);
  report('title check', problems, summary);
}
