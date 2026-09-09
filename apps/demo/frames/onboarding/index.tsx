import { type Frame, type FrameMeta, Layer, SIZES } from '@open-frame/core';
import type { CSSProperties } from 'react';
import ember from '../../themes/ember';

export const meta: FrameMeta = { title: 'Ember — Onboarding' };

export const design = ember;

const MUTED: CSSProperties = { color: 'var(--ofr-muted)', fontSize: 'var(--ofr-size-body)' };

const Dot = ({ on }: { on?: boolean }) => (
  <span
    style={{
      width: on ? 22 : 7,
      height: 7,
      borderRadius: 99,
      background: on ? 'var(--ofr-accent)' : 'var(--ofr-line)',
    }}
  />
);

const Welcome: Frame = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
    <Layer
      name="Copy"
      style={{ padding: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      <Layer
        name="Eyebrow"
        kind="text"
        as="span"
        style={{ ...MUTED, letterSpacing: '0.22em', fontSize: 'var(--ofr-size-caption)' }}
      >
        EMBER
      </Layer>
      <Layer
        name="Headline"
        kind="text"
        as="span"
        style={{
          display: 'block',
          marginTop: 22,
          fontFamily: 'var(--ofr-font-display)',
          fontSize: 'var(--ofr-size-hero)',
          lineHeight: 1.08,
          letterSpacing: '-0.02em',
        }}
      >
        Start where
        <br />
        the warmth is.
      </Layer>
      <Layer
        name="Subhead"
        kind="text"
        as="span"
        style={{ ...MUTED, display: 'block', marginTop: 20, maxWidth: 380, lineHeight: 1.7 }}
      >
        Three questions, then we will lay out a plan you can actually keep.
      </Layer>
      <Layer name="Actions" style={{ display: 'flex', gap: 12, marginTop: 34 }}>
        <span
          style={{
            background: 'var(--ofr-accent)',
            color: '#1a0f08',
            borderRadius: 999,
            padding: '11px 22px',
            fontSize: 'var(--ofr-size-body)',
            fontWeight: 500,
          }}
        >
          Get started
        </span>
        <span
          style={{
            border: '1px solid var(--ofr-line)',
            borderRadius: 999,
            padding: '11px 22px',
            fontSize: 'var(--ofr-size-body)',
            color: 'var(--ofr-muted)',
          }}
        >
          I have an account
        </span>
      </Layer>
      <Layer
        name="Progress"
        style={{ display: 'flex', gap: 6, marginTop: 44, alignItems: 'center' }}
      >
        <Dot on />
        <Dot />
        <Dot />
      </Layer>
    </Layer>

    <Layer
      name="Artwork"
      kind="image"
      style={{
        background:
          'radial-gradient(120% 90% at 70% 20%, rgba(255,122,77,.34), transparent 62%), var(--ofr-surface)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <span
        style={{
          width: 260,
          height: 260,
          borderRadius: '46% 54% 38% 62% / 52% 40% 60% 48%',
          background: 'linear-gradient(150deg, var(--ofr-accent), #8d3bff)',
          filter: 'blur(0.2px)',
        }}
      />
    </Layer>
  </div>
);

Welcome.frameName = 'Welcome · Desktop';
Welcome.size = SIZES.LAPTOP;

export default [Welcome];
