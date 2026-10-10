// The project's palettes, type scale and layout.
//
// This is the one file the kit refuses to ship. Five projects that all wrote
// `colors.muted` resolved it to five different hexes, so a shared token name
// guarantees nothing; what is shared is the set of names a kit component may
// reach for, and `rendiv-kit/node/checks/theme.mjs` holds this file to it.
//
// Both palettes carry the same keys. A dark cut missing one renders
// successfully and looks wrong on one surface only, which is the failure the
// theme check exists to move forward.
import type { Theme } from 'rendiv-kit';

export const STROKE = 2;

const LIGHT = {
  bg: '#ffffff',
  panel: '#f4f6f8',
  ink: '#101418',
  muted: '#55606b',
  // 3.29:1 on bg and 3.04:1 on panel. A rule is a graphical object, so the
  // floor is 3:1 rather than 4.5:1, and the obvious lighter grey sits just
  // under it. Checked by node/checks/a11y.mjs.
  hairline: '#848f9a',
  accent: '#0b6e4f',
  shadow: 'rgba(16, 20, 24, 0.10)',
  codeString: '#1e5aa8',
  codePunct: '#55606b',
  codePlain: '#101418',
};

const DARK = {
  bg: '#0e1216',
  panel: '#171d23',
  ink: '#f2f5f7',
  muted: '#a7b2bd',
  // 4.06:1 on bg and 3.67:1 on panel.
  hairline: '#6b7682',
  accent: '#4fd1a0',
  shadow: 'rgba(0, 0, 0, 0.45)',
  codeString: '#7fb4f0',
  codePunct: '#a7b2bd',
  codePlain: '#f2f5f7',
};

export const type = {
  display: { size: 84, weight: 800, leading: 1.14 },
  headline: { size: 68, weight: 800, leading: 1.2 },
  title: { size: 40, weight: 800, leading: 1.24 },
  lead: { size: 32, weight: 700, leading: 1.36 },
  body: { size: 28, weight: 500, leading: 1.45 },
  small: { size: 26, weight: 500, leading: 1.45 },
  label: { size: 24, weight: 700, tracking: 2.4 },
  kicker: { size: 26, weight: 700, tracking: 3.2 },
  code: { size: 26, leading: 1.6 },
};

// Name the project's faces first and keep the system fallback behind them, so a
// checkout without the font files still renders something rather than nothing.
export const fonts = {
  sans: 'system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
};

// The margin a projector may crop. Nothing is drawn outside it except furniture
// that is deliberately there, which the a11y check takes as declared exceptions.
export const layout = {
  padX: 96,
  padY: 72,
  stroke: STROKE,
};

export const themeFor = (name: 'light' | 'dark'): Theme => ({
  name,
  colors: name === 'dark' ? DARK : LIGHT,
  type,
  fonts,
  layout,
});
