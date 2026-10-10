// One component per segment id in src/timeline.json.
//
// Keyed by id rather than imported positionally, so adding a segment to the
// timeline and forgetting its component fails with that segment's name instead
// of rendering the wrong one.
import React from 'react';
import { S1 } from './S1';
import { S2 } from './S2';

export const SEGMENTS: Record<string, React.FC> = { S1, S2 };
