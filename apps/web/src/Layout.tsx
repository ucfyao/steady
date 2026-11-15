import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router';
import { PlayerMenu } from './PlayerMenu.js';
import { usePlayers } from './players/usePlayers.js';
import { Button } from './ui/Button.js';
import styles from './Layout.module.css';

type LayoutContext = { setFocusMode(on: boolean): void };

/**
 * Focus mode (Spec 004): while a screen calls this, the layout drops the header and
 * notices, so only that screen is on the page. Turns off when the caller unmounts.
 */
export function useFocusMode() {
  const setFocusMode = useOutletContext<LayoutContext | undefined>()?.setFocusMode;
  useEffect(() => {
    if (!setFocusMode) return;
    setFocusMode(true);
    return () => setFocusMode(false);
  }, [setFocusMode]);
}

function AddPlayerForm({ onDone }: { onDone(): void }) {
  const { addPlayer } = usePlayers();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addPlayer(name);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={create} className={styles.addPlayer}>
      <label className={styles.field}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus />
      </label>
      <div className={styles.actions}>
        <Button type="submit">Create</Button>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export function Layout() {
  const { status, error, retry, notice, dismissNotice, active } = usePlayers();
  const [adding, setAdding] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const outletContext = useMemo<LayoutContext>(() => ({ setFocusMode }), []);
  const avatar = useRef<HTMLButtonElement>(null);

  const doneAdding = () => {
    setAdding(false);
    avatar.current?.focus();
  };

  return (
    <div className={styles.app}>
      {!focusMode && (
        <header className={styles.header}>
          <NavLink to="/" className={styles.brand}>
            Steady
          </NavLink>
          <div className={styles.headerEnd}>
            <nav aria-label="Main">
              <NavLink to="/progress" className={styles.navLink}>
                Progress
              </NavLink>
            </nav>
            {status === 'ready' && (
              <PlayerMenu buttonRef={avatar} onAddPlayer={() => setAdding(true)} />
            )}
          </div>
        </header>
      )}

      {status === 'ready' && adding && !focusMode && <AddPlayerForm onDone={doneAdding} />}

      {notice && !focusMode && (
        <div role="status" className="notice">
          {notice}{' '}
          <Button variant="link" onClick={dismissNotice}>
            Dismiss
          </Button>
        </div>
      )}

      <main>
        {status === 'loading' && <p>Setting up…</p>}
        {status === 'error' && (
          <div role="alert" className="error">
            <p>{error}</p>
            <Button onClick={retry}>Try again</Button>
          </div>
        )}
        {/* Keyed by player: switching or deleting a player remounts every screen, so no
            screen can carry over another player's data or an open confirmation. */}
        {status === 'ready' && <Outlet key={active!.id} context={outletContext} />}
      </main>
    </div>
  );
}
