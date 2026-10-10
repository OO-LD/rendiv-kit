// @font-face declarations load lazily, so the first frames would capture before
// the faces are ready. Force every weight the video uses, and hold capture until
// they resolve.
//
// A missing face aborts rather than falling back silently, because a silent
// fallback is a different video that still renders successfully, and nothing
// downstream reports it.
//
// The face list is the project's: it names families the project ships and
// weights the project uses. The kit knows the mechanism, not the typeface, so
// the caller imports its own fonts.css and passes the list.
//
//   import '../fonts.css';
//   import { loadFonts } from 'rendiv-kit/fonts';
//
//   loadFonts([
//     '500 30px Manrope',
//     '700 30px Manrope',
//     '400 30px "IBM Plex Mono"',
//   ]);
import { abortRender, holdRender, releaseRender } from '@rendiv/core';

export const loadFonts = (faces: string[]): void => {
  if (typeof document === 'undefined' || !document.fonts) return;
  if (!faces.length) {
    abortRender('loadFonts was given no faces, so nothing would be waited for');
    return;
  }

  const handle = holdRender('fonts');
  Promise.all(faces.map((f) => document.fonts.load(f)))
    .then(() => document.fonts.ready)
    .then(() => {
      const missing = faces.filter((f) => !document.fonts.check(f));
      if (missing.length) {
        abortRender(`Fonts failed to load: ${missing.join(', ')}`);
        return;
      }
      releaseRender(handle);
    })
    .catch((err) => abortRender(`Font loading failed: ${String(err)}`));
};
