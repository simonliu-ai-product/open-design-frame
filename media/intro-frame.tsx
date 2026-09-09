import { type Frame, type FrameMeta, Layer, SIZES } from '@open-frame/core';
import aurora from '../../themes/aurora';

export const meta: FrameMeta = { title: 'Release — v0.1', createdAt: '2026-09-09' };

export const design = aurora;

const Release: Frame = () => (
  <Layer
    name="Page"
    style={{
      width: '100%',
      height: '100%',
      padding: 96,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 26,
      background: 'var(--ofr-bg)',
      color: 'var(--ofr-text)',
    }}
  >
    <Layer
      name="Eyebrow"
      kind="text"
      as="span"
      style={{
        fontFamily: 'var(--ofr-font-mono)',
        fontSize: 'var(--ofr-size-caption)',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--ofr-accent)',
      }}
    >
      Written by an agent · just now
    </Layer>
    <Layer
      name="Headline"
      kind="text"
      as="span"
      style={{
        fontSize: 'var(--ofr-size-hero)',
        fontWeight: 600,
        lineHeight: 1.04,
        letterSpacing: '-0.03em',
        maxWidth: 900,
      }}
    >
      A frame is a component.
    </Layer>
    <Layer
      name="Lede"
      kind="text"
      as="span"
      style={{
        fontSize: 'var(--ofr-size-title)',
        lineHeight: 1.55,
        color: 'var(--ofr-muted)',
        maxWidth: 720,
      }}
    >
      This screen was created over MCP while you watched, and it is ordinary TSX on disk.
    </Layer>
    <Layer name="Meta" style={{ display: 'flex', gap: 12, marginTop: 14 }}>
      {['frames/agent-card/index.tsx', '1440 × 1024', 'theme: aurora'].map((label) => (
        <span
          key={label}
          style={{
            padding: '10px 18px',
            borderRadius: 999,
            border: '1px solid var(--ofr-line)',
            background: 'var(--ofr-surface)',
            color: 'var(--ofr-muted)',
            fontFamily: 'var(--ofr-font-mono)',
            fontSize: 'var(--ofr-size-body)',
          }}
        >
          {label}
        </span>
      ))}
    </Layer>
  </Layer>
);

Release.frameName = 'Release · Desktop';
Release.size = SIZES.DESKTOP;
Release.url = 'flow.app/release';

export default [Release];
