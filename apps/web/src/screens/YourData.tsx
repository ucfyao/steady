import { useState, type FormEvent } from 'react';
import { usePlayers } from '../players/usePlayers.js';

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
      <p>
        Steady does not ask for your name or email. The server knows this player only by a random
        key, which is kept in this browser. If you clear this browser&apos;s data or switch devices,
        there is no way to recover your history.
      </p>
      <p>Player names are stored only on this device and are never sent to the server.</p>

      <form onSubmit={save} className="inline-form">
        <label>
          Name on this device{' '}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </label>
        <button type="submit">Save name</button>
      </form>

      <h2>Delete my data</h2>
      <p>Deletes every session for {active.name} from the server, then removes the player here.</p>
      {confirming ? (
        <div role="group" aria-label={`Delete all data for ${active.name}`} className="confirm">
          <p>This cannot be undone.</p>
          <button type="button" className="danger" disabled={busy} onClick={remove}>
            Yes, delete everything for {active.name}
          </button>
          <button type="button" className="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="danger" onClick={() => setConfirming(true)}>
          Delete my data
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
