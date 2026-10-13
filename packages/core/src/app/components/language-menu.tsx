import { useEffect, useRef, useState } from 'react';
import { LOCALES, useLocale, useT } from '../lib/i18n.tsx';

export function LanguageMenu() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="odf-menu" ref={ref}>
      <button
        type="button"
        className="odf-nav-icon"
        aria-label={t('nav.language')}
        aria-expanded={open}
        title={t('nav.language')}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            d="M2 3.5h7M5.5 2v1.5M3.5 3.5c.3 2.5 1.8 4.6 4.2 5.8M7.5 3.5c-.5 2.3-2 4.4-4.5 5.8M8.5 14l2.6-6.5L13.7 14M9.3 12h3.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="odf-menu-panel">
          {LOCALES.map((item) => (
            <button
              key={item.code}
              type="button"
              className="odf-menu-item"
              aria-current={locale === item.code}
              onClick={() => {
                setLocale(item.code);
                setOpen(false);
              }}
            >
              <i aria-hidden="true">{item.short}</i>
              {item.label}
              {locale === item.code ? <b aria-hidden="true">✓</b> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
