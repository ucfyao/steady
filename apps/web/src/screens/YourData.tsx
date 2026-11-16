import { useState, type FormEvent } from 'react';
import { usePlayers } from '../players/usePlayers.js';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
import styles from './YourData.module.css';

/** Remounted per player by the layout, so its state never carries over to another player. */
export function YourData() {
  const { active, rename, deleteActive } = usePlayers();
  const [name, setName] = useState(active?.name ?? '');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!active) return null;

  function save(e: FormEvent) {
    e.preventDefault();
    rename(active!.id, name);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteActive();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Your data</h1>
      <div className={styles.intro}>
        <p>
          Steady does not ask for your name or email. The server knows this player only by a random
          key, which is kept in this browser. If you clear this browser&apos;s data or switch
          devices, there is no way to recover your history.
        </p>
        <p>Player names are stored only on this device and are never sent to the server.</p>
      </div>

      <Card as="section" aria-labelledby="name-title" className={styles.section}>
        <h2 id="name-title">Name on this device</h2>
        <form onSubmit={save} className={styles.form}>
          <label className={styles.field}>
            <span className="visually-hidden">Name on this device</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
          </label>
          <Button type="submit" variant="secondary">
            Save name
          </Button>
        </form>
      </Card>

      <Card as="section" aria-labelledby="delete-title" className={styles.section}>
        <h2 id="delete-title">Delete my data</h2>
        <p className={styles.explain}>
          Deletes every session for {active.name} from the server, then removes the player here.
        </p>
        {confirming ? (
          <div
            role="group"
            aria-label={`Delete all data for ${active.name}`}
            className={styles.confirm}
          >
            <p>This cannot be undone.</p>
            <div className={styles.buttons}>
              <Button variant="danger" disabled={busy} onClick={remove}>
                Yes, delete everything for {active.name}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Delete my data
          </Button>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </Card>
    </section>
  );
}
