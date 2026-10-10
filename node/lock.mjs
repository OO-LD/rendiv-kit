// One bundler at a time in a given directory.
//
// @rendiv/bundler writes __rendiv_entry__.jsx into the project root and removes
// it once the bundle is built, so the filename is shared by every render. Two at
// once means the second overwrites the first's entry or deletes it mid-build,
// and what comes back is a black frame or a bundler error about a missing
// module. Parallel agents on one project make that the normal case rather than
// a rare one.
//
// mkdir is the lock, because it is the one filesystem operation that is atomic
// on Windows as well as on POSIX.
import { mkdirSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Long enough that a slow render is never mistaken for a dead one.
const STALE_MS = 600_000;
const WAIT_MS = 3_600_000;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export const lockDirFor = (root) => path.join(root, 'out', '.bundler-lock');

export const acquire = (lockDir, { staleMs = STALE_MS, waitMs = WAIT_MS } = {}) => {
  const until = Date.now() + waitMs;
  let announced = false;
  while (Date.now() < until) {
    try {
      mkdirSync(lockDir, { recursive: false });
      writeFileSync(path.join(lockDir, 'owner'), String(process.pid));
      return;
    } catch (err) {
      if (err.code === 'ENOENT') {
        // The parent (out/) does not exist yet on a first run.
        mkdirSync(path.dirname(lockDir), { recursive: true });
        continue;
      }
      if (err.code !== 'EEXIST') throw err;
      // A lock left behind by a killed render would otherwise block everything
      // until someone noticed. Break it once it is older than any real render.
      try {
        const age = Date.now() - statSync(lockDir).mtimeMs;
        if (age > staleMs) {
          const owner = readFileSync(path.join(lockDir, 'owner'), 'utf8').trim();
          console.error(
            `lock: breaking a stale lock held by pid ${owner} for ${Math.round(age / 1000)}s`,
          );
          rmSync(lockDir, { recursive: true, force: true });
          continue;
        }
        if (!announced) {
          console.error('lock: another render holds the bundler, waiting');
          announced = true;
        }
      } catch {
        // The holder released it between the mkdir and the stat. Retry.
      }
      sleep(250);
    }
  }
  throw new Error(`lock: waited ${waitMs / 1000}s for ${lockDir}`);
};

export const release = (lockDir) => rmSync(lockDir, { recursive: true, force: true });

export const withLock = async (lockDir, fn) => {
  acquire(lockDir);
  try {
    return await fn();
  } finally {
    release(lockDir);
  }
};
