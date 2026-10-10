import React from 'react';
import { Caption, Gap, Headline, Stage } from 'rendiv-kit';

export const S2: React.FC = () => (
  <Stage>
    <Headline lines={['What it closes on']} />
    <Gap h={28} />
    <Caption>And the attribution or the call to action.</Caption>
  </Stage>
);
