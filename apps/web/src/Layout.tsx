import { useState, type FormEvent } from 'react';
import { NavLink, Outlet } from 'react-router';
import { usePlayers } from './players/usePlayers.js';

function PlayerMenu() {
  const { profiles, active, switchTo, addPlayer } = usePlayers();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addPlayer(name);
      setName('');
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="player-menu">
      <label>
        Player{' '}
        <select value={active?.id ?? ''} onChange={(e) => switchTo(e.target.value)}>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {adding ? (
        <form onSubmit={create} className="inline-form">
          <label>
            Name <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
          </label>
          <button type="submit">Create</button>
          <button type="button" className="secondary" onClick={() => setAdding(false)}>
            Cancel
          </button>
          {error && <span role="alert">{error}</span>}
        </form>
      ) : (
        <button type="button" className="secondary" onClick={() => setAdding(true)}>
          Add player
        </button>
      )}
    </div>
  );
}

export function Layout() {
  const { status, error, retry, notice, dismissNotice, active } = usePlayers();

  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/" className="brand">
          Steady
        </NavLink>
        <nav>
          <NavLink to="/data">Your data</NavLink>
        </nav>
        {status === 'ready' && <PlayerMenu />}
      </header>

      {notice && (
        <div role="status" className="notice">
          {notice}{' '}
          <button type="button" className="link" onClick={dismissNotice}>
            Dismiss
          </button>
        </div>
      )}

      <main>
        {status === 'loading' && <p>Setting up…</p>}
        {status === 'error' && (
          <div role="alert" className="error">
            <p>{error}</p>
            <button type="button" onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {/* Keyed by player: switching or deleting a player remounts every screen, so no
            screen can carry over another player's data or an open confirmation. */}
        {status === 'ready' && <Outlet key={active!.id} />}
      </main>
    </div>
  );
}
