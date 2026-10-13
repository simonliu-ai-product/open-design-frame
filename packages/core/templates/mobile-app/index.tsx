import { type Frame, type FrameMeta, Layer, SIZES } from '@open-design-frame/core';

export const meta: FrameMeta = {
  title: 'Mobile App Flow',
  createdAt: '2026-10-13',
};

const Home: Frame = () => (
  <Layer
    name="HomeScreen"
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
    <Layer name="TopBar" style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 14, color: 'var(--odf-muted)' }}>9:41</span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>Mobile App Flow</span>
    </Layer>

    <Layer name="BalanceCard" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--odf-muted)' }}>
        Current Balance
      </span>
      <strong style={{ fontSize: 44, letterSpacing: -1.5 }}>$12,480.00</strong>
    </Layer>

    <Layer
      name="OpenDetailsButton"
      to="Activity · Phone"
      style={{
        padding: '16px 20px',
        borderRadius: 14,
        backgroundColor: 'var(--odf-accent)',
        color: '#FFFFFF',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: 16,
      }}
    >
      View Activity →
    </Layer>
  </Layer>
);

Home.frameName = 'Home · Phone';
Home.size = SIZES.PHONE;

const Activity: Frame = () => (
  <Layer
    name="ActivityScreen"
    style={{
      width: '100%',
      height: '100%',
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      backgroundColor: 'var(--odf-bg)',
      color: 'var(--odf-ink)',
    }}
  >
    <Layer
      name="BackHeader"
      to="Home · Phone"
      style={{ fontSize: 15, color: 'var(--odf-accent)', fontWeight: 600 }}
    >
      ← Back to Home
    </Layer>
    <Layer name="Title" kind="text" as="h2" style={{ margin: 0, fontSize: 28 }}>
      Recent Activity
    </Layer>
    <Layer
      name="Row1"
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: 'var(--odf-surface)',
        display: 'flex',
        justifyContent: 'space-between',
      }}
    >
      <span>Cloud Infrastructure</span>
      <strong>-$240.00</strong>
    </Layer>
  </Layer>
);

Activity.frameName = 'Activity · Phone';
Activity.size = SIZES.PHONE;

export default [Home, Activity];
