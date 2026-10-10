// A deck that builds: slides made of reveal stages, advanced one at a time.
//
// The mechanism is the kit's; the slide list is the project's. Everything here
// derives from one number, `stageFrames`, which is how long a stage is held in
// the video cut. A deck exported as slides never plays those frames, but the
// stills are sampled inside them, so one timing drives both artefacts and they
// cannot disagree about what stage 5 looks like.
import React, { createContext, useContext } from 'react';

export type DeckStage = {
  name: string;
  /** Speaker notes for this stage. Carried into a PPTX export. */
  notes?: string;
};

export type DeckClip = {
  file: string;
  poster: string;
  notes?: string;
  /** Seconds into the recording that the poster frame is cut from. */
  posterAt?: number;
};

export type DeckSlide = {
  id: string;
  title: string;
  /** Budgeted speaking time. `node/checks/budget.mjs` sums these. */
  minutes?: number;
  stages: DeckStage[];
  clip?: DeckClip;
};

export type Deck = {
  slides: DeckSlide[];
  /** Frames one reveal stage is held for. */
  stageFrames: number;
  /** Frames into a stage at which a still is sampled; the reveal has finished. */
  settleFrame: number;
  width?: number;
  height?: number;
  fps?: number;
  budgetMinutes?: number;
};

const DeckContext = createContext<Deck | null>(null);

export const DeckProvider: React.FC<{ deck: Deck; children: React.ReactNode }> = ({
  deck,
  children,
}) => React.createElement(DeckContext.Provider, { value: deck }, children);

export function useDeck(): Deck {
  const deck = useContext(DeckContext);
  if (!deck) {
    throw new Error('No deck in context. Wrap the composition in <DeckProvider deck={...}>.');
  }
  return deck;
}

export function slideById(deck: Deck, id: string): DeckSlide {
  const slide = deck.slides.find((s) => s.id === id);
  if (!slide) {
    throw new Error(`Unknown slide ${id}. The deck has: ${deck.slides.map((s) => s.id).join(', ')}`);
  }
  return slide;
}

export const durationOf = (deck: Deck, id: string): number =>
  slideById(deck, id).stages.length * deck.stageFrames;

// True once stage k has been reached. Reveals are cumulative: stage 5 of a
// worked example still shows what stages 1 to 4 put on the board, because a
// calculation that erased its own earlier lines would be useless to someone
// copying it down.
export const at = (deck: Deck, frame: number, stage: number): boolean =>
  frame >= stage * deck.stageFrames;

/** Which stage a frame is in, for slides that reorganise rather than only add. */
export const stageAt = (deck: Deck, frame: number, count: number): number =>
  Math.max(0, Math.min(count - 1, Math.floor(frame / deck.stageFrames)));

// How far into the reveal of stage k the frame is, 0 to 1. Only a video cut uses
// this for motion; stills sample at settleFrame, where it is 1.
export const into = (deck: Deck, frame: number, stage: number, len = 12): number => {
  const local = frame - stage * deck.stageFrames;
  if (local <= 0) return 0;
  return Math.min(1, local / len);
};

/** The frame each stage is sampled at, for the still driver and the exports. */
export function stageFramesOf(deck: Deck, id: string): { name: string; frame: number }[] {
  return slideById(deck, id).stages.map((s, i) => ({
    name: s.name,
    frame: i * deck.stageFrames + deck.settleFrame,
  }));
}
