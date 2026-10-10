// Every check a project has configured, in one run.
//
// Each check reports on its own and the run ends with a summary, rather than
// stopping at the first failure: a build that fixes one finding and discovers
// the next on the following run costs a render each time.
//
//   node node_modules/rendiv-kit/node/checks/index.mjs
//   node node_modules/rendiv-kit/node/checks/index.mjs theme a11y
import { loadConfig } from '../config.mjs';
import { isMain } from '../is-main.mjs';
import { runA11y } from './a11y.mjs';
import { runBarred } from './barred.mjs';
import { runBudget } from './budget.mjs';
import { runNovelty } from './novelty.mjs';
import { runStills } from './stills.mjs';
import { runTheme } from './theme.mjs';
import { runTitles } from './titles.mjs';

// Ordered cheapest and most fundamental first. A palette missing a token makes
// every later finding noise, so the theme check runs before the rest.
export const CHECKS = {
  theme: runTheme,
  a11y: runA11y,
  titles: runTitles,
  budget: runBudget,
  barred: runBarred,
  novelty: runNovelty,
  stills: runStills,
};

export function runChecks(config, names = Object.keys(CHECKS)) {
  const results = [];
  for (const name of names) {
    const run = CHECKS[name];
    if (!run) throw new Error(`Unknown check "${name}". Known: ${Object.keys(CHECKS).join(', ')}`);
    try {
      results.push({ name, ...run(config) });
    } catch (err) {
      results.push({ name, problems: [String(err.message ?? err)], summary: '' });
    }
  }
  return results;
}

if (isMain(import.meta.url)) {
  const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const config = loadConfig(process.cwd());
  const results = runChecks(config, wanted.length ? wanted : undefined);

  let failed = 0;
  for (const r of results) {
    if (r.problems.length) {
      failed += 1;
      console.error(`\n${r.name} failed:\n`);
      for (const p of r.problems) console.error(`  ${p}`);
    } else {
      console.log(`${r.name}: ${r.summary}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} of ${results.length} checks failed`);
    process.exit(1);
  }
  console.log(`\n${results.length} checks passed`);
}
