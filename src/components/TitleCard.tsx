import React, { type CSSProperties, type ReactNode } from 'react';
import { useCompositionConfig, useFrame } from '@rendiv/core';
import { enterUp, pop } from '../motion';

const column: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

type Band = {
  marginTop: number;
  delay: number;
  len?: number;
  distance?: number;
};

export type TitleMetrics = {
  eyebrow: Band & { size: number; colour: string };
  headline: Band & {
    size: number;
    colour: string;
    letterSpacing: number;
    lineHeight?: number;
    maxWidth?: number;
    /**
     * Added per line, so a multi-line slogan arrives line by line rather than as
     * a block. 0 brings the whole headline in at once.
     */
    lineStep?: number;
  };
  leads: Band & { size: number; colour: string };
};

type Props = {
  /**
   * What this frame says. The opening frame passes the subject and the leads;
   * the closing frame passes the slogan and no leads.
   */
  lines: string[];
  leads?: string;
  eyebrow: string;
  /**
   * The opening frame's content, whatever this frame shows. Rendered hidden to
   * hold the height; see the note below.
   */
  measure: { lines: string[]; leads?: string };
  /**
   * Takes the wordmark's spring value and the frame, because every project
   * animates its mark differently: some scale from nothing, some from 94 per
   * cent, one clamps the overshoot and one fades on a separate curve.
   */
  logo: (mark: number, frame: number) => ReactNode;
  metrics: TitleMetrics;
};

// The layout a video opens and closes on: wordmark, eyebrow, one block of large
// text, and nothing else. One component for both frames, so the two cannot drift
// apart.
//
// The closing frame drops the leads line and sets text of its own length.
// Centring the block would then place the wordmark and the eyebrow at a
// different height on the two frames, and a loop cuts straight from the closing
// frame back to the opening one, where that shows as a jump. A hidden copy of
// the opening frame holds the height instead and the live block is pinned to its
// top edge, so the wordmark and the eyebrow land on the same row whatever runs
// underneath them.
export const TitleCard: React.FC<Props> = ({
  lines,
  leads,
  eyebrow,
  measure,
  logo,
  metrics,
}) => {
  const frame = useFrame();
  const { fps } = useCompositionConfig();
  const mark = pop(frame, fps, 2, 14);

  const m = metrics;
  const block = (text: string[], lead?: string) => (
    <>
      {logo(mark, frame)}

      <div
        style={{
          fontSize: m.eyebrow.size,
          fontWeight: 600,
          letterSpacing: 4,
          textTransform: 'uppercase',
          color: m.eyebrow.colour,
          marginTop: m.eyebrow.marginTop,
          ...enterUp(frame, m.eyebrow.delay, m.eyebrow.len, m.eyebrow.distance),
        }}
      >
        {eyebrow}
      </div>

      <div
        style={{
          fontSize: m.headline.size,
          fontWeight: 700,
          letterSpacing: m.headline.letterSpacing,
          lineHeight: m.headline.lineHeight,
          maxWidth: m.headline.maxWidth,
          color: m.headline.colour,
          marginTop: m.headline.marginTop,
          ...(m.headline.lineStep
            ? undefined
            : enterUp(frame, m.headline.delay, m.headline.len, m.headline.distance)),
        }}
      >
        {text.map((line, i) => (
          <div
            key={`${i}-${line}`}
            style={
              m.headline.lineStep
                ? enterUp(
                    frame,
                    m.headline.delay + i * m.headline.lineStep,
                    m.headline.len,
                    m.headline.distance,
                  )
                : undefined
            }
          >
            {line}
          </div>
        ))}
      </div>

      {lead ? (
        <div
          style={{
            fontSize: m.leads.size,
            color: m.leads.colour,
            marginTop: m.leads.marginTop,
            ...enterUp(frame, m.leads.delay, m.leads.len, m.leads.distance),
          }}
        >
          {lead}
        </div>
      ) : null}
    </>
  );

  return (
    <div style={{ position: 'relative', alignSelf: 'stretch' }}>
      <div style={{ ...column, position: 'absolute', top: 0, left: 0, right: 0 }}>
        {block(lines, leads)}
      </div>
      <div style={{ ...column, visibility: 'hidden' }}>{block(measure.lines, measure.leads)}</div>
    </div>
  );
};
