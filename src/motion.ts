// The easing curves, which were byte-identical across most of the projects this
// kit was collected from and differed only in their default timings.
//
// Those timings are a project's feel, not a mechanism: one deck entered over 15
// frames from 28px, another over 22 from 26. Both are right for their own cut.
// So the numbers live in one overridable object rather than being baked into
// each signature, and a project that wants its own calls `configureMotion` once
// instead of passing the same three arguments at every call site.
import { Easing, interpolate, spring } from '@rendiv/core';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export type MotionDefaults = {
  /** Frames a fade takes. */
  fade: number;
  /** Frames an entrance takes. */
  enter: number;
  /** Pixels an entering element rises through. */
  rise: number;
  /** Frames a scene cross-dissolves over. */
  scene: number;
  springDamping: number;
  springStiffness: number;
  springMass: number;
};

export const defaults: MotionDefaults = {
  fade: 15,
  enter: 20,
  rise: 28,
  scene: 14,
  springDamping: 14,
  springStiffness: 120,
  springMass: 0.9,
};

/** Overrides the project-wide feel. Call once, at module load, before any render. */
export function configureMotion(next: Partial<MotionDefaults>): void {
  Object.assign(defaults, next);
}

export const fadeIn = (frame: number, start = 0, len = defaults.fade) =>
  interpolate(frame, [start, start + len], [0, 1], { ...clamp, easing: Easing.out(Easing.ease) });

export const fadeOut = (frame: number, start: number, len = defaults.fade) =>
  interpolate(frame, [start, start + len], [1, 0], { ...clamp, easing: Easing.in(Easing.ease) });

// Fades out over the overlap frames after the nominal duration, so the outgoing
// and incoming scenes dissolve through each other rather than cutting to bg.
export const sceneOpacity = (frame: number, duration: number, len = defaults.scene) =>
  Math.min(fadeIn(frame, 0, len), fadeOut(frame, duration, len));

export const rise = (
  frame: number,
  start = 0,
  len = defaults.enter,
  distance = defaults.rise,
) =>
  interpolate(frame, [start, start + len], [distance, 0], {
    ...clamp,
    easing: Easing.easeOut,
  });

export const pop = (
  frame: number,
  fps: number,
  delay = 0,
  damping = defaults.springDamping,
) =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping, stiffness: defaults.springStiffness, mass: defaults.springMass },
  });

export const progress = (frame: number, start: number, len: number) =>
  interpolate(frame, [start, start + len], [0, 1], clamp);

// Visible between `from` and `to`, fading at both ends. Used where one scene
// swaps its own content rather than cutting to a new scene.
//
// Named `window` in the original. That shadows the global inside any module
// importing it, which is how a scene once read `window.innerWidth` off a
// number.
export const holdBetween = (frame: number, from: number, to: number, len = defaults.scene) =>
  Math.min(fadeIn(frame, from, len), fadeOut(frame, to - len, len));

export type Enter = { opacity: number; transform: string };

export const enterUp = (
  frame: number,
  delay = 0,
  len = defaults.enter,
  distance = defaults.rise,
): Enter => ({
  opacity: fadeIn(frame, delay, len),
  transform: `translateY(${rise(frame, delay, len, distance)}px)`,
});

export const enterScale = (frame: number, fps: number, delay = 0): Enter => {
  const s = pop(frame, fps, delay);
  return { opacity: fadeIn(frame, delay, defaults.scene), transform: `scale(${0.88 + 0.12 * s})` };
};
