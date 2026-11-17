import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '../ui/Button.js';
import { usePlayers } from './usePlayers.js';
import styles from './AddPlayerDialog.module.css';

/**
 * "Add a player" as a native modal dialog: the page behind is inert, focus starts in the
 * name field, and Escape or Cancel closes it. The caller returns focus to its opener.
 * The new player joins the list; the active player stays the same.
 */
export function AddPlayerDialog({ onDone }: { onDone(): void }) {
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
  // inert, so focusing the opener would be ignored.
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
