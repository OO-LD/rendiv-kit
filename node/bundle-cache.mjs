// A bundle built once, into the project rather than into the system temp
// directory, plus the static server that serves it.
//
// @rendiv/cli builds a fresh Vite production bundle per invocation and drops it
// in os.tmpdir()/rendiv-bundle-<timestamp>, which it never removes. A project
// rendered a few hundred times leaves a few hundred copies behind; this machine
// had 1681 of them when the kit was written. Pinning the bundle under
// out/.bundle makes it one directory that is overwritten, gitignored, and
// deleted with the rest of out/.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { lockDirFor, withLock } from './lock.mjs';

export const DEFAULT_BUNDLE_DIR = 'out/.bundle';

// Resolved from the project's install rather than from the kit's, because the
// kit declares @rendiv/bundler as an optional peer and the consumer is the one
// that pins a version. file:// because Windows rejects a bare drive path as an
// ESM specifier.
const bundlerFrom = async (root) => {
  const entry = path.resolve(root, 'node_modules/@rendiv/bundler/dist/index.js');
  if (!fs.existsSync(entry)) {
    throw new Error(
      `@rendiv/bundler is not installed under ${root}. ` +
        'Add it to the project dependencies; rendiv-kit declares it as a peer.',
    );
  }
  return import(pathToFileURL(entry).href);
};

// Builds into `bundleDir` under a lock, because @rendiv/bundler writes
// __rendiv_entry__.jsx into the project root under a fixed name and two
// concurrent builds in one directory clobber each other.
export async function buildBundle({
  root,
  entry = 'src/index.tsx',
  bundleDir = DEFAULT_BUNDLE_DIR,
  log = console.log,
}) {
  const outDir = path.resolve(root, bundleDir);
  const { bundle } = await bundlerFrom(root);
  const started = Date.now();

  // Vite resolves the entry and the public directory against the working
  // directory, and npm may start a script from anywhere.
  const previous = process.cwd();
  process.chdir(root);
  try {
    await withLock(lockDirFor(root), () => bundle({ entryPoint: entry, outDir }));
  } finally {
    process.chdir(previous);
  }

  log(`bundled into ${bundleDir} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  return outDir;
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

// @rendiv/renderer keeps its own copy of this behind a package export map that
// only publishes the top level, and reaching past that into dist/ would break on
// any patch release. Sixty lines is cheaper than that coupling.
export function serve(dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      let file = path.join(dir, url === '/' ? 'index.html' : url);
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, 'index.html');
      }
      if (!fs.existsSync(file)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => server.close(),
      });
    });
  });
}

// Removes what @rendiv/cli left in the system temp directory on earlier runs.
// Reports rather than throws: a directory held open by another process is not a
// reason to fail a render.
export function sweepTempBundles({ olderThanMs = 0, dryRun = false } = {}) {
  const tmp = os.tmpdir();
  const cutoff = Date.now() - olderThanMs;
  let removed = 0;
  let bytes = 0;
  let kept = 0;

  const sizeOf = (dir) => {
    let total = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      try {
        total += e.isDirectory() ? sizeOf(p) : fs.statSync(p).size;
      } catch {
        // Vanished while being measured.
      }
    }
    return total;
  };

  for (const name of fs.readdirSync(tmp)) {
    if (!name.startsWith('rendiv-bundle-')) continue;
    const dir = path.join(tmp, name);
    try {
      if (fs.statSync(dir).mtimeMs > cutoff) {
        kept += 1;
        continue;
      }
      const size = sizeOf(dir);
      if (!dryRun) fs.rmSync(dir, { recursive: true, force: true });
      removed += 1;
      bytes += size;
    } catch {
      kept += 1;
    }
  }

  return { removed, kept, megabytes: +(bytes / 1024 / 1024).toFixed(1), dryRun };
}
