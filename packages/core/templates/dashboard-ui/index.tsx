import { type Frame, type FrameMeta, Layer, SIZES } from '@open-design-frame/core';

export const meta: FrameMeta = {
  title: 'Dashboard UI',
  createdAt: '2026-10-13',
};

const KPI = {
  padding: 24,
  borderRadius: 14,
  border: '1px solid var(--odf-border)',
  backgroundColor: 'var(--odf-surface)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 8,
};

const Overview: Frame = () => (
  <Layer
    name="AppShell"
    style={{
      width: '100%',
      height: '100%',
      display: 'grid',
      gridTemplateColumns: '240px 1fr',
      backgroundColor: 'var(--odf-bg)',
      color: 'var(--odf-ink)',
    }}
  >
    <Layer
      name="Sidebar"
      style={{
        padding: 28,
        borderRight: '1px solid var(--odf-border)',
        backgroundColor: 'var(--odf-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <strong style={{ fontSize: 18 }}>Dashboard UI</strong>
      <span style={{ fontSize: 14, color: 'var(--odf-muted)' }}>Overview</span>
      <span style={{ fontSize: 14, color: 'var(--odf-muted)' }}>Customers</span>
      <span style={{ fontSize: 14, color: 'var(--odf-muted)' }}>Settings</span>
    </Layer>

    <Layer
      name="MainContent"
      style={{ padding: 48, display: 'flex', flexDirection: 'column', gap: 32 }}
    >
      <Layer name="Header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 32 }}>Overview</h1>
        <span style={{ fontSize: 14, color: 'var(--odf-muted)' }}>Q4 Snapshot</span>
      </Layer>

      <Layer
        name="KpiRow"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}
      >
        <Layer name="MRR" style={KPI}>
          <span style={{ fontSize: 13, color: 'var(--odf-muted)' }}>Monthly Revenue</span>
          <strong style={{ fontSize: 32 }}>$84,200</strong>
        </Layer>
        <Layer name="ActiveUsers" style={KPI}>
          <span style={{ fontSize: 13, color: 'var(--odf-muted)' }}>Active Teams</span>
          <strong style={{ fontSize: 32 }}>1,420</strong>
        </Layer>
        <Layer name="Retention" style={KPI}>
          <span style={{ fontSize: 13, color: 'var(--odf-muted)' }}>Net Retention</span>
          <strong style={{ fontSize: 32 }}>118%</strong>
        </Layer>
      </Layer>
    </Layer>
  </Layer>
);

Overview.frameName = 'Overview · Desktop';
Overview.size = SIZES.DESKTOP;

export default [Overview];
