import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router';
import { PlayerMenu } from './PlayerMenu.js';
import { usePlayers } from './players/usePlayers.js';
import { Button } from './ui/Button.js';
import { Notice } from './ui/Notice.js';
import styles from './Layout.module.css';

type LayoutContext = { setFocusMode(on: boolean): void };

/**
 * Focus mode (Spec 004): while a screen calls this, the layout drops the header and
 * notices, so only that screen is on the page. Turns off when the caller unmounts.
 * A layout effect, so the header is gone before the first frame is painted.
 */
export function useFocusMode() {
  const setFocusMode = useOutletContext<LayoutContext | undefined>()?.setFocusMode;
  useLayoutEffect(() => {
    if (!setFocusMode) return;
    setFocusMode(true);
    return () => setFocusMode(false);
  }, [setFocusMode]);
}

/**
 * "Add a player" as a native modal dialog: the page behind is inert, focus starts in the
 * name field, and Escape or Cancel closes it. The caller returns focus to the avatar.
 */
function AddPlayerDialog({ onDone }: { onDone(): void }) {
  const { addPlayer } = usePlayers();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    input.current?.focus();
    return () => d?.close();
  }, []);

  // Close the modal before the caller moves focus: while it is open the rest of the page is
  // inert, so focusing the avatar would be ignored.
  const close = () => {
    dialog.current?.close();
    onDone();
  };

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addPlayer(name);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // Escape is handled here (not by the browser's own cancel), so React state closes it.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className={styles.dialog}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <form onSubmit={create}>
        <h2 id={titleId}>Add a player</h2>
        <label className={styles.field}>
          Name
          <input
            ref={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
          />
        </label>
        {error && (
          <p role="alert" className={styles.dialogError}>
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </dialog>
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

      {status === 'ready' && adding && !focusMode && <AddPlayerDialog onDone={doneAdding} />}

      {notice && !focusMode && <Notice onDismiss={dismissNotice}>{notice}</Notice>}

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
