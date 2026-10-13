import { type Frame, type FrameMeta, Layer, SIZES } from '@open-design-frame/core';

export const meta: FrameMeta = {
  title: 'Social Poster Pack',
  createdAt: '2026-10-13',
};

const SquareCard: Frame = () => (
  <Layer
    name="SquarePoster"
    style={{
      width: '100%',
      height: '100%',
      padding: 88,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: 'var(--odf-bg)',
      color: 'var(--odf-ink)',
    }}
  >
    <Layer
      name="Badge"
      kind="text"
      as="span"
      style={{
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: 'var(--odf-accent)',
      }}
    >
      Release Note
    </Layer>
    <Layer
      name="Title"
      kind="text"
      as="h1"
      style={{ margin: 0, fontSize: 84, lineHeight: 1.04, letterSpacing: -2.4 }}
    >
      Social Poster Pack
    </Layer>
    <Layer
      name="Footer"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 20,
        color: 'var(--odf-muted)',
      }}
    >
      <span>open-design-frame</span>
      <span>1080 × 1080</span>
    </Layer>
  </Layer>
);

SquareCard.frameName = 'Poster · Square';
SquareCard.size = SIZES.SQUARE;

export default [SquareCard];
