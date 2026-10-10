// Was this module run directly, or imported?
//
// Two things make the obvious spelling wrong, and both fail the same way: the
// guard never matches, the script body never runs, and the process exits 0
// having done nothing.
//
//   1. Comparing against `file://${process.argv[1]}` loses on Windows.
//      pathToFileURL yields `file:///C:/x.mjs`, three slashes and a drive
//      letter; the template string yields two.
//
//   2. Node resolves symlinks before setting import.meta.url, and npm links a
//      `file:` dependency rather than copying it. So import.meta.url is the
//      realpath inside the checkout while argv[1] is the path through
//      node_modules. Every CLI in this package is reached that way.
//
// Both sides are therefore realpath'd and compared as URLs.
import { realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function isMain(importMetaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  const resolve = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return p;
    }
  };
  try {
    return resolve(entry) === resolve(fileURLToPath(importMetaUrl));
  } catch {
    return pathToFileURL(entry).href === importMetaUrl;
  }
}
