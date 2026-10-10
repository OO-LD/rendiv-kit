// WCAG relative luminance and contrast ratio.
//
// Separated from the a11y check because it is the one part of it that is pure
// arithmetic with a published answer, so it can be tested against the values in
// the specification rather than against this implementation's own output.
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance

const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** #rgb, #rrggbb and #rrggbbaa. Alpha is ignored: a ratio needs a flat colour. */
export function rgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9A-Fa-f]{6,8}$/.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export const luminance = (hex) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/**
 * Every foreground token against every surface, in one palette.
 *
 * A token the palette does not declare is a problem, not a skip: the whole
 * point is that a token nobody measured is a token that was never checked.
 */
export function checkPalette({
  name,
  palette,
  surfaces,
  bodyTokens,
  graphicTokens,
  minRatio,
  minRatioGraphic,
}) {
  const problems = [];
  let measured = 0;

  for (const [tokens, floor, kind] of [
    [bodyTokens, minRatio, 'text'],
    [graphicTokens, minRatioGraphic, 'graphic'],
  ]) {
    for (const token of tokens) {
      if (!palette[token]) {
        problems.push(`${name} declares no token ${token}, so nothing was measured for it`);
        continue;
      }
      for (const surface of surfaces) {
        if (!palette[surface]) {
          problems.push(`${name} declares no surface ${surface}`);
          continue;
        }
        const ratio = contrast(palette[token], palette[surface]);
        measured += 1;
        if (ratio < floor) {
          problems.push(
            `${name}.${token} ${palette[token]} on ${surface} ${palette[surface]} ` +
              `measures ${ratio.toFixed(2)}:1, under the ${floor}:1 ${kind} floor`,
          );
        }
      }
    }
  }
  return { problems, measured };
}
