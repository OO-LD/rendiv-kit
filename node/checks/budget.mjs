// The deck against its slot.
//
// A talk has a slot, and one that overruns it is a defect rather than a style
// note. This prints the table and fails if the deck does not sum to the slot,
// including any title board: a budget that quietly leaves the title out is a
// budget that is twenty seconds wrong before the first claim.
//
// Under the slot fails too. Unbudgeted minutes are minutes nobody planned.
//
// It also prints the split across the declared parts, because the shape of a
// talk is the argument about it. A rebuild that drifts back into a different
// shape shows up here as one part eating another.
//
//   node node_modules/rendiv-kit/node/checks/budget.mjs
import fs from 'node:fs';
import { at, loadConfig, readJson, report } from '../config.mjs';
import { isMain } from '../is-main.mjs';

const clock = (minutes) => {
  const total = Math.round(minutes * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export function runBudget(config, log = console.log) {
  const problems = [];
  const b = config.budget;
  // A project with no deck has nothing to budget: a timeline-driven video has
  // its duration in its beats. Not configuring one is a shape, not a mistake.
  // Configuring one that is not there is a mistake.
  const deckFile = at(config, config.deck);
  if (!deckFile) {
    return { problems: [], summary: 'no deck configured, nothing to budget' };
  }
  if (!fs.existsSync(deckFile)) {
    return { problems: [`the config names a deck at ${config.deck}, which does not exist`], summary: '' };
  }
  const deck = readJson(deckFile);

  const partName = (s) =>
    s.part === undefined ? 'title board' : (deck.parts?.[s.part] ?? String(s.part));

  const rows = deck.slides.map((s) => ({
    id: s.id,
    part: partName(s),
    stages: s.stages?.length ?? 0,
    minutes: s.minutes ?? 0,
    title: s.title || '(title board)',
  }));

  const unbudgeted = rows.filter((r) => !r.minutes);
  for (const r of unbudgeted) {
    problems.push(`${r.id} declares no minutes, so it is not in the budget at all`);
  }

  const width = (key, head) => Math.max(head.length, ...rows.map((r) => String(r[key]).length));
  const w = { id: width('id', 'id'), part: width('part', 'part') };
  log(`${'id'.padEnd(w.id)}  ${'part'.padEnd(w.part)}  stages   min   time   section`);
  for (const r of rows) {
    log(
      `${r.id.padEnd(w.id)}  ${r.part.padEnd(w.part)}  ${String(r.stages).padStart(6)}  ` +
        `${r.minutes.toFixed(1).padStart(4)}  ${clock(r.minutes).padStart(5)}  ${r.title}`,
    );
  }

  log('');
  const byPart = new Map();
  for (const r of rows) {
    byPart.set(r.part, Math.round(((byPart.get(r.part) ?? 0) + r.minutes) * 100) / 100);
  }
  for (const [part, minutes] of byPart) {
    log(`${part.padEnd(16)} ${minutes.toFixed(1).padStart(5)} min  ${clock(minutes)}`);
  }

  // The declared shape, where the project states one. A part that has drifted
  // is the finding; the total can be right while the argument is wrong.
  for (const [part, want] of Object.entries(b.parts ?? {})) {
    const got = byPart.get(part);
    if (got === undefined) {
      problems.push(`the budget names a part "${part}" that no slide belongs to`);
      continue;
    }
    if (Math.abs(got - want) > b.tolerance) {
      problems.push(
        `part "${part}" budgets ${got.toFixed(1)} min against the declared ${want} min`,
      );
    }
  }

  const total = rows.reduce((sum, r) => sum + r.minutes, 0);
  const stages = rows.reduce((sum, r) => sum + r.stages, 0);
  log('');
  log(`boards    ${rows.length}`);
  log(`stages    ${stages}`);
  log(`total     ${total.toFixed(2)} min  ${clock(total)}`);
  if (b.slotMinutes) log(`slot      ${b.slotMinutes.toFixed(2)} min  ${clock(b.slotMinutes)}`);
  if (stages) log(`per stage ${((total * 60) / stages).toFixed(1)}s`);

  if (b.slotMinutes) {
    const over = total - b.slotMinutes;
    if (over > b.tolerance) {
      problems.push(`the deck is ${over.toFixed(2)} min over the ${b.slotMinutes} min slot`);
    } else if (over < -b.tolerance) {
      problems.push(
        `the deck budgets ${total.toFixed(2)} min of a ${b.slotMinutes} min slot. ` +
          'Unbudgeted minutes are minutes nobody planned; assign them to a board.',
      );
    }
  }

  return {
    problems,
    summary: `${clock(total)} across ${rows.length} boards and ${stages} stages`,
  };
}

if (isMain(import.meta.url)) {
  const config = loadConfig(process.cwd());
  const { problems, summary } = runBudget(config);
  report('budget check', problems, summary);
}
