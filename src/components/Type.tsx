// The text primitives, as the union of what five projects had each grown
// separately.
//
// Sizes come from the theme's type scale. A component takes a tier name, not a
// number, because the secondary-text size drifted from 21 to 26 to 30 between
// frames of one video when the numbers were written at the call site.
//
// Colours default to contract tokens and are overridable, so a project that
// leads with its own accent passes it rather than the kit guessing.
import React from 'react';
import { useFrame } from '@rendiv/core';
import { useTheme, tier as tierOf, type TypeTier } from '../theme';
import { enterUp, fadeIn, progress } from '../motion';

const tierStyle = (t: TypeTier): React.CSSProperties => ({
  fontSize: t.size,
  ...(t.weight === undefined ? {} : { fontWeight: t.weight }),
  ...(t.leading === undefined ? {} : { lineHeight: t.leading }),
  ...(t.tracking === undefined ? {} : { letterSpacing: t.tracking }),
});

export const Kicker: React.FC<{
  children: React.ReactNode;
  color?: string;
  delay?: number;
  gap?: number;
  /** The dot before the label. Off where a kicker sits inside furniture already. */
  dot?: boolean;
}> = ({ children, color, delay = 0, gap = 30, dot = true }) => {
  const theme = useTheme();
  const frame = useFrame();
  const c = color ?? theme.colors.accent;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        ...tierStyle(tierOf(theme, 'kicker')),
        textTransform: 'uppercase',
        color: c,
        marginBottom: gap,
        ...enterUp(frame, delay, 18, 12),
      }}
    >
      {dot ? (
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            background: c,
            display: 'inline-block',
          }}
        />
      ) : null}
      {children}
    </div>
  );
};

export const Headline: React.FC<{
  lines: string[];
  delay?: number;
  stagger?: number;
  tier?: string;
  maxWidth?: number;
  color?: string;
  align?: React.CSSProperties['textAlign'];
}> = ({ lines, delay = 0, stagger = 20, tier = 'headline', maxWidth = 1500, color, align }) => {
  const theme = useTheme();
  const frame = useFrame();
  const t = tierOf(theme, tier);
  return (
    <div
      style={{
        ...tierStyle(t),
        fontWeight: t.weight ?? 800,
        lineHeight: t.leading ?? 1.2,
        // Negative tracking tightens a large bold display line. On a running
        // sentence at quote size it reads as cramped, so it is tied to the tier
        // rather than applied to everything this component sets.
        letterSpacing: t.tracking ?? (tier === 'display' || tier === 'headline' ? -1.4 : 0),
        maxWidth,
        color: color ?? theme.colors.ink,
        textAlign: align,
      }}
    >
      {lines.map((l, i) => (
        <div key={`${i}-${l}`} style={enterUp(frame, delay + i * stagger, 26, 30)}>
          {l}
        </div>
      ))}
    </div>
  );
};

// The one line a stage is built to land. Set apart from `Headline` because it
// enters alone and after everything else, not as the first thing on the board.
export const Punchline: React.FC<{
  children: React.ReactNode;
  delay?: number;
  tier?: string;
  color?: string;
  maxWidth?: number;
}> = ({ children, delay = 0, tier = 'lead', color, maxWidth = 1500 }) => {
  const theme = useTheme();
  const frame = useFrame();
  const t = tierOf(theme, tier, theme.type.headline);
  return (
    <div
      style={{
        ...tierStyle(t),
        fontWeight: t.weight ?? 700,
        maxWidth,
        color: color ?? theme.colors.accent,
        ...enterUp(frame, delay, 24, 20),
      }}
    >
      {children}
    </div>
  );
};

// The heading of a phase inside a stage, where the stage's own headline has
// already been and gone.
export const PhaseTitle: React.FC<{
  children: React.ReactNode;
  delay?: number;
  maxWidth?: number;
  color?: string;
}> = ({ children, delay = 0, maxWidth = 1440, color }) => {
  const theme = useTheme();
  const frame = useFrame();
  const t = tierOf(theme, 'title', theme.type.headline);
  return (
    <div
      style={{
        ...tierStyle(t),
        color: color ?? theme.colors.ink,
        maxWidth,
        ...enterUp(frame, delay, 22, 18),
      }}
    >
      {children}
    </div>
  );
};

export const Caption: React.FC<{
  children: React.ReactNode;
  delay?: number;
  tier?: string;
  weight?: number;
  color?: string;
  maxWidth?: number;
}> = ({ children, delay = 0, tier = 'body', weight, color, maxWidth = 1340 }) => {
  const theme = useTheme();
  const frame = useFrame();
  const t = tierOf(theme, tier, theme.type.body);
  return (
    <div
      style={{
        ...tierStyle(t),
        fontWeight: weight ?? t.weight ?? 500,
        lineHeight: t.leading ?? 1.45,
        color: color ?? theme.colors.muted,
        maxWidth,
        ...enterUp(frame, delay, 22, 18),
      }}
    >
      {children}
    </div>
  );
};

// A short uppercase marker on a drawing: an axis name, a stage name, a legend
// entry. Smaller than a kicker and without its entrance.
export const Label: React.FC<{
  children: React.ReactNode;
  color?: string;
  tier?: string;
  style?: React.CSSProperties;
}> = ({ children, color, tier = 'label', style }) => {
  const theme = useTheme();
  const t = tierOf(theme, tier, theme.type.body);
  return (
    <div
      style={{
        ...tierStyle(t),
        fontWeight: t.weight ?? 700,
        textTransform: 'uppercase',
        color: color ?? theme.colors.muted,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// A term the audience is not assumed to know, with its expansion attached. The
// same shape every time, so a viewer learns once that it means "here is what
// that word means".
export const Define: React.FC<{
  term: string;
  body: string;
  delay?: number;
  maxWidth?: number;
  accent?: string;
}> = ({ term, body, delay = 0, maxWidth = 1060, accent }) => {
  const theme = useTheme();
  const frame = useFrame();
  const small = tierOf(theme, 'small', theme.type.body);
  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        alignItems: 'flex-start',
        textAlign: 'left',
        maxWidth,
        padding: '22px 28px',
        background: theme.colors.panel,
        border: `1px solid ${theme.colors.hairline}`,
        borderLeft: `5px solid ${accent ?? theme.colors.accent}`,
        borderRadius: 12,
        ...enterUp(frame, delay, 22, 16),
      }}
    >
      <div
        style={{
          fontSize: small.size,
          fontWeight: 800,
          letterSpacing: 1.2,
          color: accent ?? theme.colors.accent,
          whiteSpace: 'nowrap',
          paddingTop: 1,
        }}
      >
        {term}
      </div>
      <div style={{ fontSize: small.size, lineHeight: 1.45, color: theme.colors.muted }}>
        {body}
      </div>
    </div>
  );
};

// A sentence lifted verbatim from source material, marked as a quotation so it
// reads as that source's own words rather than the video's paraphrase.
export const Quote: React.FC<{
  children: React.ReactNode;
  label?: string;
  delay?: number;
  maxWidth?: number;
  align?: React.CSSProperties['textAlign'];
}> = ({ children, label, delay = 0, maxWidth = 1420, align = 'center' }) => {
  const theme = useTheme();
  const frame = useFrame();
  const grow = progress(frame, delay, 26);
  const q = tierOf(theme, 'quote', theme.type.headline);
  const k = tierOf(theme, 'kicker');
  return (
    <div style={{ maxWidth, textAlign: align }}>
      {label ? (
        <div
          style={{
            fontSize: k.size,
            fontWeight: 800,
            letterSpacing: 2.4,
            textTransform: 'uppercase',
            color: theme.colors.accent,
            marginBottom: 18,
            opacity: fadeIn(frame, delay, 18),
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        style={{
          height: 6,
          width: 160 * grow,
          background: theme.colors.accent,
          borderRadius: 3,
          margin: align === 'center' ? '0 auto 30px' : '0 0 30px',
        }}
      />
      <div
        style={{
          ...tierStyle(q),
          color: theme.colors.ink,
          ...enterUp(frame, delay + 8, 26, 20),
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const Chip: React.FC<{
  children: React.ReactNode;
  color?: string;
  bg?: string;
  style?: React.CSSProperties;
}> = ({ children, color, bg, style }) => {
  const theme = useTheme();
  const t = tierOf(theme, 'lead', theme.type.body);
  return (
    <div
      style={{
        fontSize: t.size,
        fontWeight: 700,
        color: color ?? theme.colors.ink,
        background: bg ?? theme.colors.panel,
        border: `1px solid ${theme.colors.hairline}`,
        borderRadius: 999,
        padding: '12px 26px',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Rule: React.FC<{
  delay?: number;
  width?: number;
  height?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ delay = 0, width = 160, height = 6, color, style }) => {
  const theme = useTheme();
  const frame = useFrame();
  return (
    <div
      style={{
        height,
        width: width * progress(frame, delay, 26),
        background: color ?? theme.colors.accent,
        borderRadius: height / 2,
        ...style,
      }}
    />
  );
};

/** Vertical space, as a component, so a stage reads as a list of its parts. */
export const Gap: React.FC<{ h: number }> = ({ h }) => <div style={{ height: h }} />;
