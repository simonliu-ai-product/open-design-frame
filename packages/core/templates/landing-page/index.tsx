import { type Frame, type FrameMeta, Layer, SIZES } from '@open-design-frame/core';

export const meta: FrameMeta = {
  title: 'Landing Page',
  createdAt: '2026-10-13',
};

const CARD = {
  padding: 28,
  borderRadius: 16,
  border: '1px solid var(--odf-border)',
  backgroundColor: 'var(--odf-surface)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 10,
};

const Desktop: Frame = () => (
  <Layer
    name="Page"
    style={{
      width: '100%',
      height: '100%',
      padding: '48px 80px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: 'var(--odf-bg)',
      color: 'var(--odf-ink)',
    }}
  >
    <Layer
      name="Navbar"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <Layer name="Brand" kind="text" as="span" style={{ fontSize: 18, fontWeight: 700 }}>
        Landing Page
      </Layer>
      <Layer
        name="MobilePreviewLink"
        to="Landing · Mobile"
        style={{
          padding: '10px 18px',
          borderRadius: 999,
          backgroundColor: 'var(--odf-ink)',
          color: 'var(--odf-bg)',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Preview Mobile →
      </Layer>
    </Layer>

    <Layer name="Hero" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
      <Layer
        name="Headline"
        kind="text"
        as="h1"
        style={{ margin: 0, fontSize: 68, lineHeight: 1.04, letterSpacing: -2 }}
      >
        Design in code, ship without translation.
      </Layer>
      <Layer
        name="Subhead"
        kind="text"
        as="p"
        style={{ margin: 0, fontSize: 22, lineHeight: 1.5, color: 'var(--odf-muted)' }}
      >
        Every artboard is a real React component sized to the pixel.
      </Layer>
    </Layer>

    <Layer
      name="Features"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}
    >
      <Layer name="Feature 1" style={CARD}>
        <strong style={{ fontSize: 18 }}>True Dimensions</strong>
        <span style={{ fontSize: 15, color: 'var(--odf-muted)' }}>
          1440×1024 on desktop, 390×844 on mobile — scaled by container, never distorted.
        </span>
      </Layer>
      <Layer name="Feature 2" style={CARD}>
        <strong style={{ fontSize: 18 }}>AST Inspector</strong>
        <span style={{ fontSize: 15, color: 'var(--odf-muted)' }}>
          Click any element on the canvas and write style changes straight back to TSX.
        </span>
      </Layer>
      <Layer name="Feature 3" style={CARD}>
        <strong style={{ fontSize: 18 }}>Playable Flows</strong>
        <span style={{ fontSize: 15, color: 'var(--odf-muted)' }}>
          Declare target frames on layers and walk through the user journey in Play mode.
        </span>
      </Layer>
    </Layer>
  </Layer>
);

Desktop.frameName = 'Landing · Desktop';
Desktop.size = SIZES.DESKTOP;

const Mobile: Frame = () => (
  <Layer
    name="MobilePage"
    style={{
      width: '100%',
      height: '100%',
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: 'var(--odf-bg)',
      color: 'var(--odf-ink)',
    }}
  >
    <Layer
      name="MobileHeader"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <strong style={{ fontSize: 16 }}>Landing Page</strong>
      <Layer
        name="BackToDesktop"
        to="Landing · Desktop"
        style={{ fontSize: 13, color: 'var(--odf-accent)', fontWeight: 600 }}
      >
        Desktop ↗
      </Layer>
    </Layer>
    <Layer name="MobileHero" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.08, letterSpacing: -1 }}>
        Design in code, ship without translation.
      </h1>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45, color: 'var(--odf-muted)' }}>
        Every artboard is a real React component sized to the pixel.
      </p>
    </Layer>
    <Layer name="MobileCard" style={CARD}>
      <strong style={{ fontSize: 16 }}>Ready for production</strong>
      <span style={{ fontSize: 14, color: 'var(--odf-muted)' }}>
        Export HTML, SVG, and 1×/2×/3× PNG in one zip.
      </span>
    </Layer>
  </Layer>
);

Mobile.frameName = 'Landing · Mobile';
Mobile.size = SIZES.PHONE;

export default [Desktop, Mobile];
