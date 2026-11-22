import { type AgentActivity, useAgentState } from '../../lib/agent.ts';
import { useT } from '../../lib/i18n.tsx';
import { ProviderLogo } from './provider-logo.tsx';

/** On the stage while an agent writes the file shown, so the canvas moving is never a mystery. */
export function AgentPresence({
  activity,
  onOpen,
}: {
  activity: AgentActivity;
  onOpen: () => void;
}) {
  const t = useT();
  const { status } = useAgentState();
  const name = status?.providers.find((p) => p.id === activity.provider)?.name ?? '';
  const step =
    activity.phase === 'tool'
      ? [activity.title, activity.detail?.split(/[\\/]/).pop()].filter(Boolean).join(' ')
      : t('agent.presenceThinking');
  return (
    <button type="button" className="odf-agent-presence" onClick={onOpen} data-agent-presence>
      <ProviderLogo provider={activity.provider} className="odf-agent-logo" />
      <b>{t('agent.presenceEditing', { provider: name })}</b>
      <i aria-hidden="true" className="odf-agent-dot" data-tone="accent" />
      <span className="odf-agent-presence-step odf-agent-shimmer">{step}</span>
    </button>
  );
}
