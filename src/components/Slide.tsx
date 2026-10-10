import React from 'react';
import { Fill, useFrame } from '@rendiv/core';
import { useTheme, tier as tierOf } from '../theme';
import { at, into, slideById, stageAt, useDeck } from '../deck';

// Fixed furniture at the head of every slide: the section title on the left, the
// step counter on the right. Same y on every slide, so after the second slide an
// audience stops reading it and it becomes position rather than text.
//
// The step counter exists because a deck that builds hides how much is still
// coming. Someone copying a calculation down needs to know whether a line is
// still owed.
export const SlideChrome: React.FC<{
  title: string;
  steps: number;
  current: number;
  top?: number;
}> = ({ title, steps, current, top }) => {
  const theme = useTheme();
  const { colors, layout } = theme;
  const label = tierOf(theme, 'label', theme.type.body);
  return (
    <div
      style={{
        position: 'absolute',
        top: top ?? layout.safe ?? layout.padY,
        left: layout.padX,
        right: layout.padX,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 40,
      }}
    >
      <div
        style={{
          fontSize: label.size,
          fontWeight: label.weight,
          letterSpacing: label.tracking,
          textTransform: 'uppercase',
          color: colors.muted,
        }}
      >
        {title}
      </div>
      {steps > 1 ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {Array.from({ length: steps }, (_, i) => (
            <div
              key={i}
              style={{
                width: i === current ? 26 : 12,
                height: 12,
                borderRadius: 6,
                background: i <= current ? colors.accent : colors.hairline,
                opacity: i <= current ? 1 : 0.45,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

type SlideProps = {
  id: string;
  children: React.ReactNode;
  /**
   * Slides whose content is a list rather than a statement read better pinned to
   * a common top edge than centred, because centring moves every earlier line
   * each time a later one is revealed.
   */
  top?: boolean;
  /** No chrome. Title boards and section dividers carry their own. */
  bare?: boolean;
};

export const Slide: React.FC<SlideProps> = ({ id, children, top = false, bare = false }) => {
  const deck = useDeck();
  const frame = useFrame();
  const { colors, fonts, layout } = useTheme();
  const slide = slideById(deck, id);
  const safe = layout.safe ?? layout.padY;

  return (
    <Fill
      style={{
        background: colors.bg,
        color: colors.ink,
        fontFamily: fonts.sans,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: top ? 'flex-start' : 'center',
        textAlign: 'center',
        padding: `${top ? safe + 96 : layout.padY}px ${layout.padX}px ${layout.padY}px`,
      }}
    >
      {bare ? null : (
        <SlideChrome
          title={slide.title}
          steps={slide.stages.length}
          current={stageAt(deck, frame, slide.stages.length)}
        />
      )}
      {children}
    </Fill>
  );
};

// One reveal step. The element is in the layout from the first frame and only
// becomes visible at its stage, so nothing above it moves when it arrives. A
// build that reflows is a build the audience has to re-read from the top every
// time the presenter clicks.
export const Reveal: React.FC<{
  stage: number;
  children: React.ReactNode;
  /**
   * For blocks that replace rather than extend. An alternative that has not
   * appeared yet does not need its space held.
   */
  keepSpace?: boolean;
}> = ({ stage, children, keepSpace = true }) => {
  const deck = useDeck();
  const frame = useFrame();
  const shown = at(deck, frame, stage);
  if (!shown && !keepSpace) return null;
  return <div style={{ opacity: shown ? into(deck, frame, stage) : 0 }}>{children}</div>;
};
