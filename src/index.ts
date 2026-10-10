export {
  ThemeProvider,
  useTheme,
  useOptionalTheme,
  useColors,
  useType,
  useLayout,
  useFonts,
  tier,
  type Theme,
  type Palette,
  type RequiredColors,
  type TypeScale,
  type TypeTier,
  type Fonts,
  type Layout,
} from './theme';

export {
  DeckProvider,
  useDeck,
  slideById,
  durationOf,
  at,
  into,
  stageAt,
  stageFramesOf,
  type Deck,
  type DeckSlide,
  type DeckStage,
  type DeckClip,
} from './deck';

export {
  configureMotion,
  defaults as motionDefaults,
  fadeIn,
  fadeOut,
  sceneOpacity,
  rise,
  pop,
  progress,
  holdBetween,
  enterUp,
  enterScale,
  type Enter,
  type MotionDefaults,
} from './motion';

export { loadFonts } from './fonts';

export { Stage } from './components/Stage';
export { Slide, Reveal, SlideChrome } from './components/Slide';
export { Footer } from './components/Footer';
export { TitleCard, type TitleMetrics } from './components/TitleCard';
export { Card, CardRow, CardTitle, CardBody, CardNote, type CardSkin } from './components/Cards';
export {
  CodeBlock,
  type CodeBlockProps,
  type CodeTone,
  type CodeTones,
  type Mark,
} from './components/CodeBlock';
export {
  Kicker,
  Headline,
  Punchline,
  PhaseTitle,
  Caption,
  Label,
  Define,
  Quote,
  Chip,
  Rule,
  Gap,
} from './components/Type';
