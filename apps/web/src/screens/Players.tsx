import { useRef, useState, type FormEvent } from 'react';
import type { Variant } from '@steady/core';
import { GroupTag } from '../dev/GroupTag.js';
import { usePlayerGroups } from '../dev/usePlayerGroups.js';
import { AddPlayerDialog } from '../players/AddPlayerDialog.js';
import type { Profile } from '../players/store.js';
import { usePlayers } from '../players/usePlayers.js';
import { Button } from '../ui/Button.js';
import styles from './Players.module.css';

/** Which row is open, and for what. One at a time, so the page never has two forms open. */
type Open = { id: string; kind: 'rename' | 'delete' };
/** After a row closes, the button that opened it gets focus back. */
type Return = { id: string; to: 'rename' | 'delete' };

/**
 * Manage players (Spec 004): every player on this browser, each with Rename and Delete,
 * and Add a player. Names live only here; Delete removes that player's data on the server
 * with their own token. Switching player stays in the avatar menu.
 */
export function Players() {
  const { profiles, active } = usePlayers();
  const groups = usePlayerGroups();
  const [open, setOpen] = useState<Open | null>(null);
  const [returnTo, setReturnTo] = useState<Return | null>(null);
  const [adding, setAdding] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const addArea = useRef<HTMLDivElement>(null);

  const close = (id: string, to: Return['to']) => {
    setOpen(null);
    setReturnTo({ id, to });
  };

  return (
    <section>
      {/* The list's own action sits with its title, where it stays however long the list is. */}
      <div className={styles.header}>
        <h1 ref={heading} tabIndex={-1} className={styles.title}>
          Players
        </h1>
        <div ref={addArea}>
          <Button variant="secondary" onClick={() => setAdding(true)}>
            Add a player
          </Button>
        </div>
      </div>
      <p className={styles.lead}>
        Each player&apos;s name and sessions are stored on the server under their own key. This
        browser holds the keys, so clearing its data loses access to every player&apos;s history.
      </p>

      <ul className={styles.list}>
        {profiles.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            isActive={p.id === active?.id}
            group={groups[p.id]}
            open={open?.id === p.id ? open.kind : null}
            focus={returnTo?.id === p.id ? returnTo.to : null}
            onOpen={(kind) => {
              setReturnTo(null);
              setOpen({ id: p.id, kind });
            }}
            onClose={(to) => close(p.id, to)}
            onDeleted={() => {
              setOpen(null);
              heading.current?.focus();
            }}
          />
        ))}
      </ul>

      {adding && (
        <AddPlayerDialog
          onDone={() => {
            setAdding(false);
            addArea.current?.querySelector('button')?.focus();
          }}
        />
      )}
    </section>
  );
}

function PlayerRow({
  player,
  isActive,
  group,
  open,
  focus,
  onOpen,
  onClose,
  onDeleted,
}: {
  player: Profile;
  isActive: boolean;
  /** Development only (Spec 011): the player's own group. */
  group: Variant | undefined;
  open: Open['kind'] | null;
  focus: Return['to'] | null;
  onOpen(kind: Open['kind']): void;
  onClose(to: Return['to']): void;
  onDeleted(): void;
}) {
  const { rename, deletePlayer } = usePlayers();
  const [draft, setDraft] = useState(player.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = draft.trim();
  const unchanged = trimmed === '' || trimmed === player.name;

  // Spec 013: the name is renamed on the server first; a failure keeps the old name.
  async function save(e: FormEvent) {
    e.preventDefault();
    if (unchanged || busy) return;
    setBusy(true);
    setError(null);
    try {
      await rename(player.id, draft);
      setBusy(false);
      onClose('rename');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      // Deleting the active player remounts the page as the next one; otherwise the row goes.
      await deletePlayer(player.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const inputId = `name-${player.id}`;

  return (
    <li className={styles.row}>
      {open === 'rename' ? (
        <form
          onSubmit={save}
          className={styles.renameForm}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose('rename');
            }
          }}
        >
          <label htmlFor={inputId} className="visually-hidden">
            New name for {player.name}
          </label>
          <input
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={30}
            autoFocus
          />
          <div className={styles.formButtons}>
            <Button type="submit" disabled={unchanged || busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setError(null);
                onClose('rename');
              }}
            >
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </form>
      ) : (
        <div className={styles.summary}>
          <span className={styles.name}>
            {player.name}
            <GroupTag variant={group} />
            {isActive && <span className={styles.tag}>Playing now</span>}
          </span>
          {open !== 'delete' && (
            <span className={styles.actions}>
              <Button
                variant="link"
                className={styles.action}
                aria-label={`Rename ${player.name}`}
                autoFocus={focus === 'rename'}
                onClick={() => {
                  setDraft(player.name);
                  onOpen('rename');
                }}
              >
                Rename
              </Button>
              <Button
                variant="link"
                className={`${styles.action} ${styles.danger}`}
                aria-label={`Delete ${player.name}`}
                autoFocus={focus === 'delete'}
                onClick={() => {
                  setError(null);
                  onOpen('delete');
                }}
              >
                Delete
              </Button>
            </span>
          )}
        </div>
      )}

      {open === 'delete' && (
        <div
          role="group"
          aria-label={`Delete all data for ${player.name}`}
          className={styles.confirm}
        >
          <p>
            Deletes {player.name}&apos;s sessions from the server and removes {player.name} from
            this browser. This cannot be undone.
          </p>
          <div className={styles.formButtons}>
            <Button
              variant="danger"
              disabled={busy}
              onClick={remove}
              className={styles.confirmButton}
            >
              Yes, delete everything for {player.name}
            </Button>
            {/* The row's Delete button is hidden, so focus moves to the safe choice. */}
            <Button variant="secondary" autoFocus onClick={() => onClose('delete')}>
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
