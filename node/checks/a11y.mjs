// Five properties a lecture hall enforces whether or not anyone checks them, so
// they are checked here instead of discovered from the back row.
//
//   1. contrast   every foreground token against every surface, in every palette
//   2. type size  nothing under minSize unless argued for in the allowlist
//   3. stroke     no drawn edge under minStroke, which is what VGA takes first
//   4. dwell      no stage too short to read
//   5. safe area  nothing placed outside the margin the projector may crop
//
// All five are static. They read the theme source, the deck or timeline, and
// the source under srcDir; none of them needs a render.
//
//   node node_modules/rendiv-kit/node/checks/a11y.mjs
import fs from 'node:fs';
import path from 'node:path';
import { at, loadConfig, readJson, relTo, report, walk } from '../config.mjs';
import { numberFrom, readPalettes, typeTiersFrom } from '../theme-source.mjs';
import { checkPalette } from './contrast.mjs';

export function runA11y(config) {
  const problems = [];
  const a = config.a11y;
  const themeFile = at(config, config.themeSource);
  const files = walk(at(config, config.srcDir));
  const rel = (f) => relTo(config.root, f);

  // 1. Contrast

  const { palettes, missing, source: themeSrc } = readPalettes(themeFile, config.palettes);
  for (const name of missing) {
    problems.push(
      `contrast: ${config.themeSource} holds no palette named ${name}. ` +
        'Nothing was measured for it, so a failure there would not show up here.',
    );
  }
  let measured = 0;
  for (const [name, palette] of Object.entries(palettes)) {
    const r = checkPalette({
      name,
      palette,
      surfaces: a.surfaces,
      bodyTokens: a.bodyTokens,
      graphicTokens: a.graphicTokens,
      minRatio: a.minRatio,
      minRatioGraphic: a.minRatioGraphic,
    });
    problems.push(...r.problems.map((p) => `contrast: ${p}`));
    measured += r.measured;
  }

  // 2. Type size

  const allow = readJson(at(config, a.allow), []);
  for (const entry of allow) {
    if (!entry.why?.trim()) {
      problems.push(`type size: allowlist entry "${entry.where}" has no why`);
    }
  }

  // An exception naming a token in the type scale matches that token exactly.
  // One naming a file matches any line in it, because pinning an exception to a
  // line number means an edit above it turns the exception into a failure
  // somewhere else, and the lesson people take from that is to widen the
  // allowlist rather than to look at what moved.
  const allowed = (where, size) =>
    allow.some(
      (x) =>
        x.size === size &&
        x.why?.trim() &&
        (x.where.includes(' ') ? x.where === where : where.startsWith(x.where)),
    );

  for (const file of files) {
    if (rel(file) === config.themeSource) continue;
    fs.readFileSync(file, 'utf-8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        // Both spellings. A size set as a JSX prop, fontSize={24}, is the same
        // 24px on screen as one set in a style object, and matching only the
        // style form once let a segment ship sub-floor type under a clean run.
        const decl = line.match(/fontSize:\s*([^,}\n]+)/) ?? line.match(/fontSize=\{([^}]+)\}/);
        if (!decl) return;
        const sizes = [...decl[1].matchAll(/\b(\d+)\b/g)].map((m) => Number(m[1]));
        if (!sizes.length) return;
        const smallest = Math.min(...sizes);
        const where = `${rel(file)}:${i + 1}`;
        if (smallest < a.minSize && !allowed(where, smallest)) {
          problems.push(
            `type size: ${where} sets fontSize ${smallest}, under ${a.minSize}. ` +
              `Raise it or add it to ${a.allow} with a reason.`,
          );
        }
      });
  }

  for (const t of typeTiersFrom(themeSrc)) {
    const where = `${config.themeSource} type.${t.name}`;
    if (t.size < a.minSize && !allowed(where, t.size)) {
      problems.push(`type size: ${where} is ${t.size}, under ${a.minSize}.`);
    }
  }

  // 3. Stroke
  //
  // Every drawn edge comes from a token or from a literal, and a literal under
  // the floor is what this catches. SVG stroke widths and CSS border widths are
  // both checked, because a deck draws with both.

  for (const file of files) {
    if (rel(file) === config.themeSource) continue;
    fs.readFileSync(file, 'utf-8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        const hits = [
          ...line.matchAll(/strokeWidth=\{([\d.]+)\}/g),
          ...line.matchAll(/strokeWidth:\s*([\d.]+)/g),
          ...line.matchAll(/border(?:Top|Bottom|Left|Right)?:\s*`?(\d+)px/g),
        ];
        for (const h of hits) {
          const value = Number(h[1]);
          const where = `${rel(file)}:${i + 1}`;
          if (value < a.minStroke && !allowed(where, value)) {
            problems.push(
              `stroke: ${where} draws a ${value}px edge, under ${a.minStroke}px. ` +
                'A thin line is the first thing an analogue chain removes.',
            );
          }
        }
      });
  }

  // 4. Dwell

  const stages = dwellUnits(config);
  for (const u of stages) {
    if (u.seconds < a.minDwell) {
      problems.push(
        `dwell: ${u.id} gives each of its ${u.count} stages ${u.seconds.toFixed(1)}s, ` +
          `under ${a.minDwell}s. Cut a stage or buy it time.`,
      );
    }
  }

  // 5. Safe area

  const padX = numberFrom(themeSrc, 'padX');
  const padY = numberFrom(themeSrc, 'padY');
  if (padX === undefined || padY === undefined) {
    problems.push(
      `safe area: ${config.themeSource} declares no padX/padY, so no margin was enforced`,
    );
  } else {
    const floors = { top: padY, bottom: padY, left: padX, right: padX };
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
      let depth = null;
      lines.forEach((line, i) => {
        if (depth === null) {
          if (!/position:\s*'absolute'/.test(line)) return;
          depth = 0;
        }
        for (const [, prop, raw] of line.matchAll(/\b(top|right|bottom|left):\s*(\d+)\b/g)) {
          const value = Number(raw);
          const where = `${rel(file)}:${i + 1}`;
          const ok = a.safeAreaAllow.some(
            (x) => x.file === rel(file) && x.prop === prop && x.value === value,
          );
          if (value < floors[prop] && !ok) {
            problems.push(
              `safe area: ${where} places an absolute element at ${prop} ${value}, ` +
                `inside the ${floors[prop]}px margin. A projector may crop it.`,
            );
          }
        }
        for (const ch of line) {
          if (ch === '{') depth += 1;
          else if (ch === '}') depth -= 1;
        }
        if (depth <= 0) depth = null;
      });
    }
  }

  return {
    problems,
    summary:
      `${measured} contrast pairs across ${Object.keys(palettes).length} palettes, ` +
      `type >= ${a.minSize}px and strokes >= ${a.minStroke}px outside ${allow.length} ` +
      `argued exceptions, ${stages.length} units >= ${a.minDwell}s, ` +
      `nothing inside the ${padY}/${padX} margin`,
  };
}

// How long each reveal stage gets. A deck declares minutes per slide; a
// timeline declares frames per beat. Both answer the same question.
function dwellUnits(config) {
  const deckFile = at(config, config.deck);
  if (deckFile && fs.existsSync(deckFile)) {
    const deck = readJson(deckFile);
    return deck.slides
      .filter((s) => s.minutes && s.stages?.length)
      .map((s) => ({
        id: s.id,
        count: s.stages.length,
        seconds: (s.minutes * 60) / s.stages.length,
      }));
  }

  const tlFile = at(config, config.timeline);
  if (tlFile && fs.existsSync(tlFile)) {
    const tl = readJson(tlFile);
    return tl.segments.flatMap((seg) =>
      (seg.beats ?? []).map((b) => ({
        id: `${seg.id}.${b.name}`,
        count: 1,
        seconds: b.len / tl.fps,
      })),
    );
  }
  return [];
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const config = loadConfig(process.cwd());
  const { problems, summary } = runA11y(config);
  report('a11y check', problems, summary);
}
