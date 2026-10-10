import React from 'react';
import { Fill } from '@rendiv/core';
import { useTheme } from '../theme';

type Props = {
  children: React.ReactNode;
  opacity?: number;
  justify?: React.CSSProperties['justifyContent'];
  align?: React.CSSProperties['alignItems'];
  textAlign?: React.CSSProperties['textAlign'];
  padX?: number;
  padY?: number;
  /** Drawn behind the children, under the padding. A rail, a grid, a wash. */
  backdrop?: React.ReactNode;
  /**
   * Furniture drawn below everything a block can occupy, inside the bottom
   * padding. Off on title frames, which carry their own eyebrow.
   */
  footer?: React.ReactNode;
  style?: React.CSSProperties;
};

// Every scene is centred on both axes by default. Blocks inside only need to set
// their own max width; they do not position themselves.
//
// Furniture is drawn by the Stage rather than by each scene, so it cannot drift
// by a pixel between frames. A scene that needs it on some beats and not others
// passes it conditionally.
export const Stage: React.FC<Props> = ({
  children,
  opacity = 1,
  justify = 'center',
  align = 'center',
  textAlign = 'center',
  padX,
  padY,
  backdrop,
  footer,
  style,
}) => {
  const { colors, fonts, layout } = useTheme();
  return (
    <Fill
      style={{
        background: colors.bg,
        color: colors.ink,
        fontFamily: fonts.sans,
        display: 'flex',
        flexDirection: 'column',
        alignItems: align,
        justifyContent: justify,
        textAlign,
        padding: `${padY ?? layout.padY}px ${padX ?? layout.padX}px`,
        opacity,
        ...style,
      }}
    >
      {backdrop}
      {children}
      {footer}
    </Fill>
  );
};
