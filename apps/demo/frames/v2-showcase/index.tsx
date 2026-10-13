import { type Frame, type FrameMeta, Layer, SIZES } from '@open-design-frame/core';
import type { CSSProperties } from 'react';
import ember from '../../themes/ember';

export const meta: FrameMeta = {
  title: 'Open-Design-Frame — Feature Showcase',
  createdAt: '2026-10-13',
};

export const design = ember;

const CARD: CSSProperties = {
  padding: 28,
  borderRadius: 'var(--odf-radius-lg)',
  background: 'var(--odf-surface)',
  border: '1px solid var(--odf-line)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const BADGE: CSSProperties = {
  display: 'inline-block',
  padding: '5px 12px',
  borderRadius: 'var(--odf-radius-pill)',
  background: 'rgba(255, 122, 77, 0.14)',
  color: 'var(--odf-accent)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const StudioDesktop: Frame = () => (
  <Layer
    name="Desktop Canvas"
    style={{
      width: '100%',
      height: '100%',
      padding: 64,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      background: 'var(--odf-bg)',
      color: 'var(--odf-text)',
    }}
  >
    <Layer
      name="Header"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <Layer name="Brand" kind="text" style={{ fontSize: 18, fontWeight: 700 }}>
        open-design-frame · studio
      </Layer>
      <Layer
        name="Mobile Preview Link"
        to="Mobile Companion"
        style={{
          padding: '8px 16px',
          borderRadius: 999,
          border: '1px solid var(--odf-line)',
          fontSize: 13,
          color: 'var(--odf-muted)',
        }}
      >
        Jump to Mobile Companion →
      </Layer>
    </Layer>

    <Layer name="Hero Section" style={{ maxWidth: 820 }}>
      {/* @frame-comment id="c-de000001" ts="2026-10-13T15:20:00.000Z" text="eyJub3RlIjoiU3dpdGNoIGJldHdlZW4gU2luZ2xlIC8gU3BsaXQgLyBHcmlkIGluIHRoZSB0b3BiYXIgb3IgcHJlc3MgRCBmb3IgR2l0IENoYW5nZXMuIn0" */}
      <Layer name="Pill" kind="text" as="span" style={BADGE}>
        NEW IN OPEN-DESIGN-FRAME
      </Layer>
      <Layer
        name="Headline"
        kind="text"
        style={{
          marginTop: 18,
          fontFamily: 'var(--odf-font-display)',
          fontSize: 56,
          lineHeight: 1.06,
          letterSpacing: '-0.03em',
          fontWeight: 700,
        }}
      >
        Shared styles, Git diffs, and 5-locale design canvas.
      </Layer>
      <Layer
        name="Subtitle"
        kind="text"
        style={{
          marginTop: 16,
          fontSize: 18,
          lineHeight: 1.6,
          color: 'var(--odf-muted)',
          maxWidth: 640,
        }}
      >
        Click any card below to inspect its inherited style constant (`from CARD`), pin review
        comments directly on the artboard, or switch to Split / Grid mode.
      </Layer>
    </Layer>

    <Layer
      name="Feature Grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
      }}
    >
      <Layer name="Shared Style Card" style={CARD}>
        {/* @frame-comment id="c-de000002" ts="2026-10-13T15:21:00.000Z" text="eyJub3RlIjoiVHJ5IGVkaXRpbmcgdGhpcyBjYXJkIOKAlCBpdCBpbmhlcml0cyBmcm9tIHNoYXJlZCBzdHlsZSBjb25zdGFudCBDQVJEISJ9" */}
        <Layer name="Card 1 Title" kind="text" style={{ fontSize: 18, fontWeight: 600 }}>
          1. Shared Style Overrides
        </Layer>
        <Layer
          name="Card 1 Body"
          kind="text"
          style={{ fontSize: 14, color: 'var(--odf-muted)', lineHeight: 1.55 }}
        >
          Uses `style={'{CARD}'}`. Editing it in Inspect automatically spreads `{`{ ...CARD, ... }`}
          ` in TSX.
        </Layer>
      </Layer>

      <Layer name="Git Diff Card" style={{ ...CARD, borderColor: 'var(--odf-accent)' }}>
        <Layer name="Card 2 Title" kind="text" style={{ fontSize: 18, fontWeight: 600 }}>
          2. On-Canvas Git Diff (Δ)
        </Layer>
        <Layer
          name="Card 2 Body"
          kind="text"
          style={{ fontSize: 14, color: 'var(--odf-muted)', lineHeight: 1.55 }}
        >
          Press `D` or open Changes to highlight modified elements on the canvas and revert
          individual hunks.
        </Layer>
      </Layer>

      <Layer name="Multi-View Card" style={CARD}>
        <Layer name="Card 3 Title" kind="text" style={{ fontSize: 18, fontWeight: 600 }}>
          3. Single · Split · Grid + ⌘K
        </Layer>
        <Layer
          name="Card 3 Body"
          kind="text"
          style={{ fontSize: 14, color: 'var(--odf-muted)', lineHeight: 1.55 }}
        >
          Compare artboards side-by-side, run DOM layout checks in Inspect → Checks, or switch 5
          languages.
        </Layer>
      </Layer>
    </Layer>
  </Layer>
);
StudioDesktop.frameName = 'Showcase · Desktop';
StudioDesktop.size = SIZES.DESKTOP;

const MobileCompanion: Frame = () => (
  <Layer
    name="Mobile Screen"
    style={{
      width: '100%',
      height: '100%',
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      background: 'var(--odf-bg)',
      color: 'var(--odf-text)',
    }}
  >
    <Layer
      name="Top Bar"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <Layer
        name="Back Link"
        to="Showcase · Desktop"
        kind="text"
        style={{ fontSize: 13, color: 'var(--odf-accent)' }}
      >
        ← Desktop
      </Layer>
      <Layer name="Status" kind="text" style={{ fontSize: 12, color: 'var(--odf-muted)' }}>
        v0.1.1
      </Layer>
    </Layer>

    <Layer name="Mobile Hero" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Layer name="Mobile Badge" kind="text" as="span" style={BADGE}>
        SPLIT VIEW READY
      </Layer>
      <Layer
        name="Mobile Title"
        kind="text"
        style={{
          fontFamily: 'var(--odf-font-display)',
          fontSize: 34,
          lineHeight: 1.1,
          fontWeight: 700,
        }}
      >
        Compare desktop & mobile side by side.
      </Layer>
      <Layer name="Mobile Card" style={CARD}>
        <Layer name="Mobile Card Title" kind="text" style={{ fontSize: 16, fontWeight: 600 }}>
          Synced with MCP `/__current`
        </Layer>
        <Layer
          name="Mobile Card Text"
          kind="text"
          style={{ fontSize: 13, color: 'var(--odf-muted)', lineHeight: 1.5 }}
        >
          Your coding agent knows which artboard and layer you have selected in real time.
        </Layer>
      </Layer>
    </Layer>

    <Layer
      name="CTA"
      to="Showcase · Desktop"
      style={{
        padding: '14px 20px',
        borderRadius: 14,
        background: 'var(--odf-accent)',
        color: '#1a0f08',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: 15,
      }}
    >
      Back to Desktop Artboard
    </Layer>
  </Layer>
);
MobileCompanion.frameName = 'Mobile Companion';
MobileCompanion.size = SIZES.PHONE;

export default [StudioDesktop, MobileCompanion];
