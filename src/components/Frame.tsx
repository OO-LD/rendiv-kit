// The frame a video is drawn in: a stack of scenes, and the furniture that
// outlives them.
//
// Furniture is anything that belongs to the video rather than to a scene: the
// line naming it, a framing statement, a progress rail. It has to be drawn
// once, above the scene stack, and three separate things go wrong if it is not.
//
//   1. Inside a scene it inherits that scene's opacity. The usual caller passes
//      a cross-dissolve, so the furniture dissolves with the scene. Measured on
//      a five-scene cut: alpha holds at 1.000, dips to 0.355 over 14 frames at
//      every boundary, and returns. Both scenes sit near 0.21 where they meet,
//      so the band partly reaches the background. It is conspicuous precisely
//      because furniture is the one thing that should not move, and on a loop
//      it reads as the video stuttering.
//
//   2. Drawn once per scene and placed outside that scene's opacity, it is
//      drawn twice during a dissolve, because both scenes are mounted. Two
//      copies at 0.72 composite to 0.92. That trades the dip for a thickening.
//
//   3. Hoisted to a sibling after the scene stack, it paints *under* the
//      scenes. `Sequence` sets `zIndex: 10000 - trackIndex`, which beats any
//      plain sibling. The result is zero ink on settled frames with a peak at
//      the crossover, the exact inverse of the first failure. Guessing a higher
//      z-index does not fix it; an isolated stacking context on the stack does.
//
// `SceneStack` supplies the isolation and `Furniture` supplies the font, which
// is the fourth trap: outside a `Stage` there is no `fontFamily`, so hoisted
// furniture silently falls back to the browser default serif.
import React, { type CSSProperties, type ReactNode } from 'react';
import { Fill } from '@rendiv/core';
import { useOptionalTheme } from '../theme';

/**
 * The scenes, in a stacking context of their own.
 *
 * `Sequence` paints near the top of the z range, which would otherwise draw the
 * scenes over anything that follows them. `isolation: isolate` keeps that
 * inside.
 */
export const SceneStack: React.FC<{ children: ReactNode; style?: CSSProperties }> = ({
  children,
  style,
}) => <Fill style={{ isolation: 'isolate', ...style }}>{children}</Fill>;

/**
 * The layer above the scenes, for everything that outlives a scene.
 *
 * Carries the font because there is no `Stage` out here to inherit it from, and
 * nothing else: a background would cover the scenes it is meant to sit over.
 */
export const Furniture: React.FC<{
  children: ReactNode;
  /** Falls back to the theme. Required when there is no provider. */
  fontFamily?: string;
  color?: string;
  style?: CSSProperties;
}> = ({ children, fontFamily, color, style }) => {
  const theme = useOptionalTheme();
  const family = fontFamily ?? theme?.fonts.sans;
  if (!family) {
    throw new Error(
      'Furniture needs a font: pass `fontFamily`, or render it inside a ThemeProvider. ' +
        'Without one it inherits the browser default serif.',
    );
  }
  return (
    <Fill
      style={{
        fontFamily: family,
        color: color ?? theme?.colors.ink,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {children}
    </Fill>
  );
};

type FrameProps = {
  /** The scenes. Usually a list of `Sequence`. */
  children: ReactNode;
  /** Drawn once, above every scene, outside any scene's opacity. */
  furniture?: ReactNode;
  /**
   * Painted under everything. Defaults to the theme background, so a dissolve
   * resolves against the video's own surface rather than a transparent canvas.
   */
  background?: string;
  /** Passed to the furniture layer. Falls back to the theme. */
  fontFamily?: string;
  style?: CSSProperties;
};

/**
 * The composition root: scenes in an isolated stack, furniture above them.
 *
 *   <Frame furniture={<Footer label="Episode 1" />}>
 *     {scenes.map((s) => <Sequence key={s.id} from={s.from} ...><Scene /></Sequence>)}
 *   </Frame>
 */
export const Frame: React.FC<FrameProps> = ({
  children,
  furniture,
  background,
  fontFamily,
  style,
}) => {
  const theme = useOptionalTheme();
  return (
    <Fill style={{ background: background ?? theme?.colors.bg, ...style }}>
      <SceneStack>{children}</SceneStack>
      {furniture ? <Furniture fontFamily={fontFamily}>{furniture}</Furniture> : null}
    </Fill>
  );
};
