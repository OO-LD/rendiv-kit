// Removes the bundles @rendiv/cli left in the system temp directory.
//
// It builds a fresh Vite production bundle per invocation into
// os.tmpdir()/rendiv-bundle-<timestamp> and removes none of them. The machine
// this kit was collected on had 1681 of them. Projects that render through
// `fastStills` stop adding to the pile, because that path pins its bundle under
// out/.bundle; this clears what is already there.
//
//   node node_modules/rendiv-kit/node/sweep.mjs            remove them
//   node node_modules/rendiv-kit/node/sweep.mjs --dry-run  count them first
//   node node_modules/rendiv-kit/node/sweep.mjs --days 7   keep the recent ones
import { parseArgs } from './rendiv.mjs';
import { sweepTempBundles } from './bundle-cache.mjs';

const { values, flags } = parseArgs(process.argv.slice(2), ['days']);
const days = values.days ? Number(values.days) : 0;

const r = sweepTempBundles({
  olderThanMs: days * 24 * 60 * 60 * 1000,
  dryRun: flags.has('dry-run'),
});

const verb = r.dryRun ? 'would remove' : 'removed';
console.log(
  `sweep: ${verb} ${r.removed} rendiv bundle(s), ${r.megabytes} MB` +
    (r.kept ? `, kept ${r.kept}` : ''),
);
