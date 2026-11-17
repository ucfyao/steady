import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ApiError } from '../api/client.js';
import { parseImportHash } from '../players/importLink.js';
import { usePlayers } from '../players/usePlayers.js';
import { Loading } from '../ui/Loading.js';
import { StatusPage } from '../ui/StatusPage.js';

function errorText(e: unknown): string {
  if (e instanceof ApiError && e.kind === 'unauthorized')
    return "This link doesn't match a player on this server. The player may have been deleted, or the database was reset. Run pnpm seed:demo again for a new link.";
  if (e instanceof ApiError && e.kind === 'network')
    return 'Could not reach the server, so the link could not be checked. Make sure the API is running, then open the link again.';
  return e instanceof Error ? e.message : String(e);
}

const MISSING =
  'This link is incomplete: it has no player token. Copy the whole link printed by pnpm seed:demo and open it again.';

/**
 * `/import#token=…&name=…`: adds a player from a link (the demo player from `pnpm seed:demo`).
 * The hash is removed from the address bar at once, so the token does not stay in history.
 */
export function Import() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { importPlayer } = usePlayers();
  // Read once: the hash is cleared below, and StrictMode runs the effect twice.
  const [link] = useState(() => parseImportHash(hash));
  const [error, setError] = useState<string | null>(link ? null : MISSING);
  const started = useRef(false);

  useEffect(() => {
    const { pathname, search } = window.location;
    if (window.location.hash)
      window.history.replaceState(window.history.state, '', pathname + search);
    if (!link || started.current) return;
    started.current = true;
    importPlayer(link.token, link.name)
      .then(() => navigate('/progress', { replace: true }))
      .catch((e: unknown) => setError(errorText(e)));
  }, [link, importPlayer, navigate]);

  if (!error) return <Loading label="Checking the link…" />;

  // The link cannot be retried from here, so the only way on is home (Spec 010).
  return (
    <StatusPage
      title="Couldn't import this player"
      alert
      primary={{ label: 'Back to home', to: '/' }}
    >
      {error}
    </StatusPage>
  );
}
