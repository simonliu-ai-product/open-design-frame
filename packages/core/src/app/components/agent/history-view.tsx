import type { AgentSessionSummary } from '../../../agent/types.ts';
import { useLocale } from '../../lib/i18n.tsx';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

function relativeTime(iso: string, locale: string, now: number): string {
  const seconds = (Date.parse(iso) - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'second');
}

export function HistoryView({
  sessions,
  activeId,
  frameId,
  onSelect,
  onDelete,
}: {
  sessions: AgentSessionSummary[];
  activeId: string | null;
  frameId: string | null;
  onSelect: (session: AgentSessionSummary) => void;
  onDelete: (id: string) => void;
}) {
  const { locale, t } = useLocale();
  const groups = [
    {
      id: 'here',
      label: t('agent.historyThisFile'),
      items: sessions.filter((s) => s.frameId === frameId),
    },
    {
      id: 'other',
      label: t('agent.historyOtherFiles'),
      items: sessions.filter((s) => s.frameId !== frameId),
    },
  ].filter((g) => g.items.length > 0);
  const now = Date.now();

  if (sessions.length === 0) {
    return (
      <div className="odf-agent-scroll odf-agent-empty-history">
        <p>{t('agent.noSessions')}</p>
        <p className="odf-agent-hint">{t('agent.historyEmptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="odf-agent-scroll" data-agent-history>
      {groups.map((group) => (
        <section key={group.id} className="odf-agent-history-group">
          <h3 className="odf-agent-eyebrow">{group.label}</h3>
          <ul>
            {group.items.map((s) => {
              const running = s.status === 'running';
              return (
                <li key={s.id} className="odf-agent-history-row">
                  <button
                    type="button"
                    aria-current={s.id === activeId ? 'true' : undefined}
                    onClick={() => onSelect(s)}
                  >
                    <span className="odf-agent-history-title">{s.title}</span>
                    <span className="odf-agent-history-meta">
                      {running ? (
                        <span className="odf-agent-shimmer">{t('agent.sessionRunning')}</span>
                      ) : (
                        <span>{relativeTime(s.updatedAt, locale, now)}</span>
                      )}
                      {group.id === 'other' && s.frameId ? <code>{s.frameId}</code> : null}
                    </span>
                  </button>
                  {running ? null : (
                    <button
                      type="button"
                      className="odf-agent-action odf-agent-history-delete"
                      aria-label={t('agent.deleteSession')}
                      title={t('agent.deleteSession')}
                      onClick={() => onDelete(s.id)}
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
