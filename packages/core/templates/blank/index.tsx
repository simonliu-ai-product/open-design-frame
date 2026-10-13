import { type Frame, type FrameMeta, Layer, SIZES } from '@open-design-frame/core';

export const meta: FrameMeta = {
  title: 'Blank Frame',
  createdAt: '2026-10-13',
};

const Main: Frame = () => (
  <Layer
    name="Canvas"
    style={{
      width: '100%',
      height: '100%',
      padding: 80,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 20,
      backgroundColor: 'var(--odf-bg)',
      color: 'var(--odf-ink)',
    }}
  >
    <Layer
      name="Eyebrow"
      kind="text"
      as="span"
      style={{
        fontSize: 'var(--odf-size-caption)',
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        color: 'var(--odf-accent)',
      }}
    >
      01 · Artboard
    </Layer>
    <Layer
      name="Headline"
      kind="text"
      as="h1"
      style={{
        margin: 0,
        fontSize: 'var(--odf-size-hero)',
        lineHeight: 1.05,
        letterSpacing: -1.5,
      }}
    >
      Blank Frame
    </Layer>
    <Layer
      name="Lead"
      kind="text"
      as="p"
      style={{
        margin: 0,
        maxWidth: 640,
        fontSize: 'var(--odf-size-lead)',
        lineHeight: 1.5,
        color: 'var(--odf-muted)',
      }}
    >
      Start composing layers, tokens, and prototype links right in TSX.
    </Layer>
  </Layer>
);

Main.frameName = 'Main · Desktop';
Main.size = SIZES.DESKTOP;

export default [Main];
