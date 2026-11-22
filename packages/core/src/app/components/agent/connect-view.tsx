import { useState } from 'react';
import type { AgentProviderId, AgentProviderStatus } from '../../../agent/types.ts';
import { installProvider, refreshStatus, useAgentState, useAgentStatus } from '../../lib/agent.ts';
import { useT } from '../../lib/i18n.tsx';
import { ProviderLogo } from './provider-logo.tsx';

const CLI_INSTALL: Record<AgentProviderId, string> = {
  codex: 'npm install -g @openai/codex',
};

const needsCli = (p: AgentProviderStatus) => !p.cliFound && !p.ready;

export function ConnectView() {
  const t = useT();
  const { status, loading, enabled } = useAgentStatus();
  const { installing, connectErrors } = useAgentState();
  const [checking, setChecking] = useState(false);
  const providers = status?.providers ?? [];
  const missing = providers.filter(needsCli);
  const onlyMissing = missing.length > 0 && missing.length === providers.length;
  const name = missing[0]?.name ?? '';

  return (
    <div className="odf-agent-scroll odf-agent-connect">
      <span className="odf-agent-eyebrow">{t('agent.title')}</span>
      <h2>{onlyMissing ? t('agent.needCliTitle', { name }) : t('agent.connectTitle')}</h2>
      <p className="odf-agent-lede">
        {onlyMissing ? t('agent.needCliDescription', { name }) : t('agent.connectDescription')}
      </p>

      {loading ? (
        <p className="odf-agent-hint">{t('agent.statusLoading')}</p>
      ) : !enabled ? (
        <p className="odf-agent-hint">{t('agent.disabled')}</p>
      ) : (
        <>
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              packageManager={status?.packageManager || 'npm'}
              installing={installing === provider.id}
              busy={installing !== null}
              error={connectErrors[provider.id]}
            />
          ))}
          {missing.length > 0 ? (
            <button
              type="button"
              className="odf-chip"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                try {
                  await refreshStatus();
                } finally {
                  setChecking(false);
                }
              }}
            >
              ↻ {t('agent.checkAgain')}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  packageManager,
  installing,
  busy,
  error,
}: {
  provider: AgentProviderStatus;
  packageManager: string;
  installing: boolean;
  busy: boolean;
  error: string | undefined;
}) {
  const t = useT();
  const missing = needsCli(provider);
  const cliLabel = provider.cliFound
    ? provider.cliVersion
      ? t('agent.cliFound', { version: provider.cliVersion })
      : t('agent.cliFoundNoVersion')
    : t('agent.cliMissing');

  return (
    <div className="odf-agent-card" data-agent-provider-card={provider.id}>
      <div className="odf-agent-card-head">
        <div>
          <h3>
            <ProviderLogo provider={provider.id} className="odf-agent-logo" />
            {provider.name}
          </h3>
          <p className={provider.cliFound ? 'odf-agent-hint' : 'odf-agent-hint odf-agent-warn'}>
            {cliLabel}
          </p>
        </div>
        {provider.ready ? (
          <span className="odf-agent-badge">✓ {t('agent.connected')}</span>
        ) : installing ? (
          <span className="odf-agent-hint odf-agent-shimmer">{t('agent.connecting')}</span>
        ) : missing ? null : (
          <button
            type="button"
            className="odf-agent-button"
            disabled={busy}
            onClick={() => void installProvider(provider.id).catch(() => {})}
          >
            {error ? t('agent.retry') : t('agent.connect')}
          </button>
        )}
      </div>
      {missing ? (
        <>
          <p className="odf-agent-hint">{t('agent.cliHint', { name: provider.name })}</p>
          <code className="odf-agent-command">{CLI_INSTALL[provider.id]}</code>
        </>
      ) : error && !installing ? (
        <p className="odf-agent-hint odf-agent-warn">{error}</p>
      ) : (
        <p className="odf-agent-hint">
          {provider.ready
            ? `${provider.sdkPackage} v${provider.sdkVersion}`
            : t('agent.connectInstallHint', { pkg: provider.sdkPackage, pm: packageManager })}
        </p>
      )}
    </div>
  );
}
