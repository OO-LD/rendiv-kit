import React from 'react';
import { useFrame } from '@rendiv/core';
import { Caption, Gap, Headline, Kicker, Stage, holdBetween } from 'rendiv-kit';

// Beat boundaries come from src/timeline.json. They are written out here as
// running totals because a beat's own component needs to know when it is on,
// and the alternative, deriving them at render time, puts the timeline parser
// in every segment.
const OPEN = 0;
const CLAIM = 90;
const END = 210;

export const S1: React.FC = () => {
  const frame = useFrame();
  return (
    <Stage>
      <div style={{ opacity: holdBetween(frame, OPEN, CLAIM) }}>
        <Kicker>Section</Kicker>
        <Headline lines={['What this segment opens on']} />
      </div>

      <div style={{ opacity: holdBetween(frame, CLAIM, END), position: 'absolute' }}>
        <Headline lines={['The claim it lands']} />
        <Gap h={28} />
        <Caption>The line underneath it.</Caption>
      </div>
    </Stage>
  );
};
