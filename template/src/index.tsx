// The compositions, one per segment of src/timeline.json.
//
// Derived from the timeline rather than listed here, so a retimed segment
// cannot leave a composition declaring the old length. The same file drives the
// still driver, the checks and the deck exports.
import React from 'react';
import { Composition, Fill, setRootComponent } from '@rendiv/core';
import { ThemeProvider, loadFonts } from 'rendiv-kit';
import timeline from './timeline.json';
import { themeFor } from './theme';
import { SEGMENTS } from './segments';
import './fonts.css';

// Every weight the video uses. A face that fails to load aborts the render
// rather than falling back, because a silent fallback is a different video that
// still renders successfully.
//
// System families while the template ships no font files. Replace these with
// the project's own the moment src/fonts.css declares any, or this guard is
// checking that the fallback loaded.
loadFonts(['400 30px sans-serif', '700 30px sans-serif', '400 30px monospace']);

export type Props = { theme: 'light' | 'dark' };

// Each composition is bound to its own component here, rather than to one
// component that looks its segment up by id at render time. A still driver sets
// the input props wholesale, so an id carried in defaultProps does not survive
// into the render: the lookup then resolves to nothing and every frame comes
// out as empty background, successfully.
const COMPOSITIONS: Record<string, React.FC<Props>> = Object.fromEntries(
  Object.entries(SEGMENTS).map(([id, Body]) => [
    id,
    ({ theme }: Props) => (
      <ThemeProvider theme={themeFor(theme)}>
        <Fill>
          <Body />
        </Fill>
      </ThemeProvider>
    ),
  ]),
);

// A segment in the timeline with no component is a composition that would
// render blank. Fail at module load, naming it.
const orphans = timeline.segments.map((s) => s.id).filter((id) => !COMPOSITIONS[id]);
if (orphans.length) {
  throw new Error(
    `src/timeline.json declares ${orphans.join(', ')}, which src/segments has no component for`,
  );
}

const Root: React.FC = () => (
  <>
    {timeline.segments.map((seg) => (
      <Composition
        key={seg.id}
        id={seg.id}
        component={COMPOSITIONS[seg.id]}
        durationInFrames={seg.beats.reduce((n, b) => n + b.len, 0)}
        fps={timeline.fps}
        width={timeline.width}
        height={timeline.height}
        defaultProps={{ theme: 'light' as const }}
      />
    ))}
  </>
);

setRootComponent(Root);
