import { useEffect, useRef, useState } from 'react';

export type MenuItem = {
  key: string;
  label: string;
  icon?: string;
  danger?: boolean;
  current?: boolean;
  /** Turns the row into a second page of the same menu rather than an action. */
  submenu?: MenuItem[];
  /** Asks once before doing it: the row becomes this label until it is clicked again. */
  confirmLabel?: string;
  onSelect?: () => void;
};

export type MenuProps = { label: string; items: MenuItem[]; className?: string };

/**
 * The ⋯ on a row.
 *
 * A menu that closes on the next pointer down anywhere else, because a menu
 * left open over a grid hides the thing it belongs to.
 */
export function Menu({ label, items, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<MenuItem[] | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
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

  useEffect(() => {
    if (open) return;
    setPage(null);
    setArmed(null);
  }, [open]);

  const shown = page ?? items;

  return (
    <div className={className ? `of-menu ${className}` : 'of-menu'} ref={ref}>
      <button
        type="button"
        className="of-menu-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open ? (
        <div className="of-menu-panel">
          {page ? (
            <button type="button" className="of-menu-back" onClick={() => setPage(null)}>
              ‹ Back
            </button>
          ) : null}
          {shown.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.danger ? 'of-menu-item of-menu-danger' : 'of-menu-item'}
              aria-current={item.current}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.submenu) {
                  setPage(item.submenu);
                  return;
                }
                if (item.confirmLabel && armed !== item.key) {
                  setArmed(item.key);
                  return;
                }
                setOpen(false);
                item.onSelect?.();
              }}
            >
              <i aria-hidden="true">{item.icon ?? ''}</i>
              {armed === item.key && item.confirmLabel ? item.confirmLabel : item.label}
              {item.current ? <b aria-hidden="true">✓</b> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
