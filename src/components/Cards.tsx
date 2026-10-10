// The card shell and its entrance, which were the same in every video that had
// a row of them. The metrics and everything inside a card are the project's.
import React, { type CSSProperties, type ReactNode } from 'react';
import { useCompositionConfig, useFrame } from '@rendiv/core';
import { useTheme } from '../theme';
import { fadeIn, pop } from '../motion';

/** The surface a card is drawn on. Defaults to the theme; override per card. */
export type CardSkin = {
  panel: string;
  hairline: string;
  shadow?: string;
};

type CardProps = {
  skin?: Partial<CardSkin>;
  /**
   * The top rule. Projects that colour each card separately pass a different one
   * per card. Defaults to the theme accent.
   */
  accent?: string;
  width: number;
  padding: string;
  delay: number;
  /** How far the card travels on the way in. */
  rise?: number;
  /**
   * Lays the card out as a column so a child can grow and push a foot slot to
   * the bottom edge of a stretched card. Off by default, because a block card
   * keeps an inline SVG icon on its own line box, and switching to flex would
   * drop the leading under it and move everything below by a few pixels.
   */
  column?: boolean;
  children: ReactNode;
};

export const Card: React.FC<CardProps> = ({
  skin,
  accent,
  width,
  padding,
  delay,
  rise = 28,
  column = false,
  children,
}) => {
  const { colors } = useTheme();
  const frame = useFrame();
  const { fps } = useCompositionConfig();
  const s = pop(frame, fps, delay, 16);
  const flow: CSSProperties = column ? { display: 'flex', flexDirection: 'column' } : {};
  const panel = skin?.panel ?? colors.panel;
  const hairline = skin?.hairline ?? colors.hairline;
  const shadow = skin?.shadow ?? colors.shadow;
  return (
    <div
      style={{
        width,
        boxSizing: 'border-box',
        ...flow,
        background: panel,
        border: `2px solid ${hairline}`,
        borderTop: `8px solid ${accent ?? colors.accent}`,
        borderRadius: 18,
        padding,
        textAlign: 'left',
        ...(shadow ? { boxShadow: `0 16px 40px ${shadow}` } : {}),
        opacity: fadeIn(frame, delay, 18),
        transform: `translateY(${(1 - s) * rise}px)`,
      }}
    >
      {children}
    </div>
  );
};

// Cards stretch to the tallest of the row, so a card with a short body still
// carries its rule and its foot slot at the same height as its neighbours.
export const CardRow: React.FC<{ gap: number; children: ReactNode }> = ({ gap, children }) => (
  <div style={{ display: 'flex', gap, alignItems: 'stretch' }}>{children}</div>
);

export const CardTitle: React.FC<{
  size: number;
  lineHeight: number;
  /**
   * Height held for the title whether or not it wraps, so the bodies across the
   * row start on the same baseline. Set from the longest title in the row.
   */
  reserve: number;
  marginTop: number;
  marginBottom?: number;
  colour?: string;
  children: ReactNode;
}> = ({ size, lineHeight, reserve, marginTop, marginBottom, colour, children }) => (
  <div
    style={{
      fontSize: size,
      fontWeight: 700,
      lineHeight,
      minHeight: reserve,
      marginTop,
      marginBottom,
      color: colour,
    }}
  >
    {children}
  </div>
);

export const CardBody: React.FC<{
  size: number;
  lineHeight: number;
  colour: string;
  /**
   * Takes the slack in a column card, so whatever follows sits on the bottom
   * edge rather than under the text.
   */
  grow?: boolean;
  opacity?: number;
  children: ReactNode;
}> = ({ size, lineHeight, colour, grow, opacity, children }) => (
  <div style={{ fontSize: size, lineHeight, color: colour, flexGrow: grow ? 1 : undefined, opacity }}>
    {children}
  </div>
);

// The foot slot, ruled off from the body. Carries whatever the project names as
// the card's outcome.
export const CardNote: React.FC<{
  hairline?: string;
  size: number;
  lineHeight: number;
  colour: string;
  marginTop: number;
  paddingTop: number;
  children: ReactNode;
}> = ({ hairline, size, lineHeight, colour, marginTop, paddingTop, children }) => {
  const { colors } = useTheme();
  return (
    <div
      style={{
        marginTop,
        paddingTop,
        borderTop: `2px solid ${hairline ?? colors.hairline}`,
        fontSize: size,
        lineHeight,
        fontWeight: 600,
        color: colour,
      }}
    >
      {children}
    </div>
  );
};
