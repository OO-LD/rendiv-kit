// A quoted listing, inked by line group and by marked token.
//
// The original carried a fixed vocabulary of groups, one per layer of the format
// it happened to be about. A group here is any name the project chooses, paired
// with the two colours it inks: `ink` for the glyphs and `wash` for the band
// behind the line. The kit owns the tokenizer, the reveal and the mark
// splitting; which layers exist, and what colour each one is, is the project's.
import React from 'react';
import { useTheme, tier as tierOf } from '../theme';

type Kind = 'key' | 'string' | 'punct' | 'number';
type Token = { text: string; kind: Kind };

/** The ink and the band behind it, for one named group. */
export type CodeTone = { ink: string; wash?: string };
export type CodeTones = Record<string, CodeTone>;

/**
 * A run of characters to pull out of the grey wherever it appears. Used where
 * the point of a board is one token inside an otherwise ordinary listing, and
 * washing the whole line would say the whole line matters.
 */
export type Mark = { text: string; tone: string };

export type CodeBlockProps = {
  code: string;
  /** Which tone a line belongs to. 1-based, matching how a listing is read. */
  groupOf?: (lineNo: number) => string;
  /** Named tones. Any name not present here falls back to plain code colour. */
  tones?: CodeTones;
  /** 0 to 1, lines appearing in order. */
  reveal?: number;
  /** Opacity of the band behind a line, per group. */
  wash?: Record<string, number>;
  fontSize?: number;
  marks?: Mark[];
  /**
   * Set where the listing is quoted beside another one and the two have to keep
   * the same width whatever their longest line is.
   */
  width?: number;
  /**
   * A line drawn under the block, for a quotation that needs an attribution the
   * panel cannot hold.
   */
  foot?: string;
};

// A line of JSON, split into strings, keys, numbers and everything else. Enough
// for quoting a document on a slide; not a parser.
const jsonTokens = (line: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j += 1;
      const text = line.slice(i, j + 1);
      let k = j + 1;
      while (k < line.length && line[k] === ' ') k += 1;
      tokens.push({ text, kind: line[k] === ':' ? 'key' : 'string' });
      i = j + 1;
    } else {
      let j = i;
      while (j < line.length && line[j] !== '"') j += 1;
      const text = line.slice(i, j);
      tokens.push({ text, kind: /\d/.test(text) ? 'number' : 'punct' });
      i = j;
    }
  }
  return tokens;
};

// Split a token wherever a mark occurs, so the mark can be inked without the
// tokenizer having to know about it. Longest mark first, or a shorter one eats
// the start of a longer one.
const applyMarks = (tokens: Token[], marks: Mark[]): { t: Token; mark?: Mark }[] => {
  if (!marks.length) return tokens.map((t) => ({ t }));
  const sorted = [...marks].sort((a, b) => b.text.length - a.text.length);
  const out: { t: Token; mark?: Mark }[] = [];
  for (const token of tokens) {
    let rest = token.text;
    while (rest) {
      let best: { at: number; mark: Mark } | null = null;
      for (const mark of sorted) {
        const at = rest.indexOf(mark.text);
        if (at >= 0 && (!best || at < best.at)) best = { at, mark };
      }
      if (!best) {
        out.push({ t: { text: rest, kind: token.kind } });
        break;
      }
      if (best.at > 0) out.push({ t: { text: rest.slice(0, best.at), kind: token.kind } });
      out.push({ t: { text: best.mark.text, kind: token.kind }, mark: best.mark });
      rest = rest.slice(best.at + best.mark.text.length);
    }
  }
  return out;
};

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  groupOf = () => 'plain',
  tones = {},
  reveal = 1,
  wash = {},
  fontSize,
  marks = [],
  width,
  foot,
}) => {
  const theme = useTheme();
  const { colors, fonts, layout } = theme;
  const codeTier = tierOf(theme, 'code', theme.type.body);
  const labelTier = tierOf(theme, 'label', theme.type.body);
  // The thinnest edge the deck draws. A VGA chain takes a hairline first, so a
  // project that has measured its projector sets this rather than taking 1px.
  const stroke = layout.stroke ?? 2;

  // Resolved per render, not at module scope: a project swaps its palette
  // between the light and the dark cut, and a table built once would freeze the
  // light colours and render the dark cut half light.
  const plainInk = colors.codePlain ?? colors.ink;
  const toneInk = (g: string): string => tones[g]?.ink ?? plainInk;
  const toneWash = (g: string): string => tones[g]?.wash ?? 'transparent';

  const kindColor = (kind: Kind, group: string): string => {
    switch (kind) {
      case 'key':
        return toneInk(group);
      case 'number':
        return colors.codeNumber ?? toneInk(group);
      case 'string':
        return colors.codeString ?? plainInk;
      default:
        return colors.codePunct ?? colors.muted;
    }
  };

  const lines = code.split('\n');
  const shown = reveal * lines.length;

  return (
    <div
      style={{
        fontFamily: fonts.mono,
        fontSize: fontSize ?? codeTier.size,
        lineHeight: codeTier.leading ?? 1.6,
        // A mono face commonly draws -> as a single arrow glyph. A listing has
        // to be what the file says, so the ligatures are off.
        fontVariantLigatures: 'none',
        background: colors.panel,
        border: `${stroke}px solid ${colors.hairline}`,
        borderRadius: 16,
        padding: '22px 30px',
        textAlign: 'left',
        width,
        boxSizing: 'border-box',
        ...(colors.shadow ? { boxShadow: `0 16px 40px ${colors.shadow}` } : {}),
      }}
    >
      {lines.map((line, idx) => {
        const lineNo = idx + 1;
        const group = groupOf(lineNo);
        const local = Math.max(0, Math.min(1, shown - idx));
        const washAmount = wash[group] ?? 0;
        return (
          <div key={lineNo} style={{ position: 'relative', opacity: local, whiteSpace: 'pre' }}>
            <div
              style={{
                position: 'absolute',
                inset: '-2px -12px',
                borderRadius: 6,
                background: toneWash(group),
                opacity: washAmount,
              }}
            />
            <span style={{ position: 'relative' }}>
              {applyMarks(jsonTokens(line), marks).map(({ t, mark }, ti) => (
                <span
                  key={ti}
                  style={{
                    color: mark ? toneInk(mark.tone) : kindColor(t.kind, group),
                    fontWeight: mark || t.kind === 'key' ? 700 : 500,
                    ...(mark
                      ? {
                          background: toneWash(mark.tone),
                          borderRadius: 4,
                          padding: '2px 4px',
                          margin: '0 -2px',
                          // Marked tokens are underlined as well as inked,
                          // because a hue is the first thing a projector chain
                          // takes and the mark is usually the claim of the board.
                          borderBottom: `${stroke}px solid ${toneInk(mark.tone)}`,
                        }
                      : {}),
                  }}
                >
                  {t.text}
                </span>
              ))}
            </span>
          </div>
        );
      })}
      {foot ? (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `${stroke}px solid ${colors.hairline}`,
            fontFamily: fonts.sans,
            fontSize: labelTier.size,
            fontWeight: 600,
            color: colors.muted,
            whiteSpace: 'normal',
          }}
        >
          {foot}
        </div>
      ) : null}
    </div>
  );
};
