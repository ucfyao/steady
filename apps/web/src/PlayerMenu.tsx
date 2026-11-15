import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Link } from 'react-router';
import { usePlayers } from './players/usePlayers.js';
import styles from './Layout.module.css';

const initialOf = (name: string) => Array.from(name.trim())[0]?.toUpperCase() ?? '?';

/**
 * The avatar menu (WAI-ARIA menu button): switch player, add a player, Your data.
 * Opens on click, Enter, Space or the arrow keys; the arrows, Home and End move between
 * items; Escape closes it and returns focus to the avatar; Tab or a click outside closes it.
 */
export function PlayerMenu({
  buttonRef,
  onAddPlayer,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  onAddPlayer(): void;
}) {
  const { profiles, active, switchTo } = usePlayers();
  const [open, setOpen] = useState<null | 'first' | 'last'>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    const all = items();
    (open === 'first' ? all[0] : all.at(-1))?.focus();

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (!active) return null;

  const close = (refocus = true) => {
    setOpen(null);
    if (refocus) buttonRef.current?.focus();
  };

  const onButtonKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(e.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const all = items();
    const i = all.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      e.preventDefault();
      all[(to + all.length) % all.length]?.focus();
    };
    if (e.key === 'ArrowDown') move(i + 1);
    else if (e.key === 'ArrowUp') move(i - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(all.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') close(false);
  };

  return (
    <div className={styles.menuRoot} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.avatar}
        aria-label={`Player: ${active.name}`}
        aria-haspopup="menu"
        aria-expanded={open !== null}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : setOpen('first'))}
        onKeyDown={onButtonKeyDown}
      >
        <span aria-hidden="true">{initialOf(active.name)}</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Player"
          className={styles.menu}
          onKeyDown={onMenuKeyDown}
        >
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === active.id}
              tabIndex={-1}
              className={styles.item}
              onClick={() => {
                switchTo(p.id);
                close();
              }}
            >
              {p.name}
            </button>
          ))}
          <div role="separator" className={styles.separator} />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={styles.item}
            onClick={() => {
              close(false);
              onAddPlayer();
            }}
          >
            Add player
          </button>
          <Link
            to="/data"
            role="menuitem"
            tabIndex={-1}
            className={styles.item}
            onClick={() => close()}
          >
            Your data
          </Link>
        </div>
      )}
    </div>
  );
}
