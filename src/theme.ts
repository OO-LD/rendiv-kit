// The theme contract, and the context the kit components read it through.
//
// No palette ships here. Five projects that all wrote `colors.muted` resolved it
// to five different hexes, so a token name alone guarantees nothing; what the
// kit can own is the set of names a shared component is allowed to reach for,
// and a check that a project palette provides them.
//
// The required token lists live in theme-contract.json, which is the file
// node/checks/theme.mjs reads. The types below mirror it, and node/kit.test.mjs
// fails if the two drift apart.
import React, { createContext, useContext } from 'react';

export type TypeTier = {
  size: number;
  weight?: number;
  /** Unitless line-height. */
  leading?: number;
  /** Letter-spacing in px. */
  tracking?: number;
};

/** The colours every kit component may reach for. A project adds its own on top. */
export type RequiredColors = {
  /** The surface a scene is drawn on. */
  bg: string;
  /** Body and headline text on `bg`. */
  ink: string;
  /** Secondary text. Must clear contrast on `bg` and on `panel` alike. */
  muted: string;
  /** A drawn edge, the thinnest thing on screen. */
  hairline: string;
  /** A raised surface: cards, code blocks, quote boxes. */
  panel: string;
  /** The one colour the project leads with. */
  accent: string;
};

export type Palette = RequiredColors & Record<string, string>;

export type RequiredType = {
  kicker: TypeTier;
  headline: TypeTier;
  body: TypeTier;
};

export type TypeScale = RequiredType & Record<string, TypeTier>;

export type Layout = {
  /** Horizontal safe margin, inside which everything is drawn. */
  padX: number;
  /** Vertical safe margin. */
  padY: number;
} & Record<string, number>;

export type Fonts = {
  /** The family stack the Stage sets for the whole frame. */
  sans: string;
  /** The family stack for code and values. */
  mono: string;
} & Record<string, string>;

export type Theme = {
  colors: Palette;
  type: TypeScale;
  fonts: Fonts;
  layout: Layout;
  /** `light` or `dark`, or whatever a project calls its cuts. */
  name?: string;
};

// No default. A component rendered outside a provider would otherwise draw in
// some fallback palette and look plausible, which is the failure mode this
// whole contract exists to prevent.
const ThemeContext = createContext<Theme | null>(null);

export const ThemeProvider: React.FC<{ theme: Theme; children: React.ReactNode }> = ({
  theme,
  children,
}) => React.createElement(ThemeContext.Provider, { value: theme }, children);

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error(
      'No theme in context. Wrap the composition in <ThemeProvider theme={...}>; ' +
        'the kit ships no palette of its own.',
    );
  }
  return theme;
}

/**
 * The theme if there is one, null otherwise.
 *
 * For components that can draw entirely from their props and only consult the
 * theme for defaults. Those must not force a provider on a project that passes
 * its colours explicitly: demanding one would make adopting a single component
 * an all-or-nothing change to the whole tree.
 */
export const useOptionalTheme = (): Theme | null => useContext(ThemeContext);

/** `useTheme().colors`, which is most of what a component wants. */
export const useColors = (): Palette => useTheme().colors;
export const useType = (): TypeScale => useTheme().type;
export const useLayout = (): Layout => useTheme().layout;
export const useFonts = (): Fonts => useTheme().fonts;

/**
 * A tier by name, so a component takes `tier="small"` rather than a number.
 * The secondary-text size drifted from 21 to 26 to 30 between frames of one
 * video when sizes were written out at the call site.
 */
export function tier(theme: Theme, name: string, fallback?: TypeTier): TypeTier {
  const t = theme.type[name];
  if (t) return t;
  if (fallback) return fallback;
  throw new Error(
    `The theme declares no type tier "${name}". It has: ${Object.keys(theme.type).join(', ')}`,
  );
}
