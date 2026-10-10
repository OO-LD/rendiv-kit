import React, { type CSSProperties } from 'react';

// Pinned as a literal rather than taken from the project palette. `colors.muted`
// looked like one rule but resolved to a different hex in every palette, so five
// videos ran five different footers while appearing to share a spec. The colour
// is the one thing this component refuses to take from the theme.
//
// It stays overridable by an explicit prop, because a project on a dark surface
// needs a different value and should have to say so rather than inherit a token
// that silently differs.
const COLOUR = '#5F5F5F';

const spec: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 44,
  textAlign: 'center',
  fontSize: 21,
  fontWeight: 500,
  letterSpacing: 1.4,
  pointerEvents: 'none',
};

type Props = {
  label: string;
  /**
   * Multiplier for the beat that brings the footer back mid-scene, so it arrives
   * with the rest of the frame instead of snapping on.
   */
  fade?: number;
  colour?: string;
  opacity?: number;
};

// Names the video on every frame, so a viewer arriving mid-loop can tell which
// of a set is running. Absolutely positioned, so it never takes height from the
// beat above it. The font family is inherited from the Stage, which sets it for
// the whole frame.
export const Footer: React.FC<Props> = ({ label, fade = 1, colour = COLOUR, opacity = 0.72 }) => (
  <div style={{ ...spec, color: colour, opacity: opacity * fade }}>{label}</div>
);
