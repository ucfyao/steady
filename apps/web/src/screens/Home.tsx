import { useEffect, useState } from 'react';
import { usePlayers } from '../players/usePlayers.js';

export function Home() {
  const { api, active } = usePlayers();
  const [completed, setCompleted] = useState<number | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    api
      .listSessions()
      .then((sessions) => !cancelled && setCompleted(sessions.length))
      .catch(() => !cancelled && setCompleted(null));
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <section>
      <h1>Hi, {active?.name}</h1>
      <p className="lead">A three-minute focus check. Catch every 3, keep a steady rhythm.</p>
      {completed !== null && <p>Sessions completed: {completed}</p>}
    </section>
  );
}
