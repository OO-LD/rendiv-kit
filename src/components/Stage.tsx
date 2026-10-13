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
  style?: React.CSSProperties;
};

// Every scene is centred on both axes by default. Blocks inside only need to set
// their own max width; they do not position themselves.
//
// `opacity` is the scene's own, and the usual caller passes a cross-dissolve.
// Everything here is therefore inside it, which is right for the scene's
// content and wrong for anything that outlives the scene. A footer drawn here
// dissolves with the scene and dips to about a third at every boundary; see
// <Furniture> in Frame.tsx, which draws it once above the whole stack.
export const Stage: React.FC<Props> = ({
  children,
  opacity = 1,
  justify = 'center',
  align = 'center',
  textAlign = 'center',
  padX,
  padY,
  backdrop,
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
    </Fill>
  );
};
