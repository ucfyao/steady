import type { CompletedSession, ProgressSummary } from '@steady/core';
import { useEffect, useState } from 'react';
import { usePlayers } from '../players/usePlayers.js';
import { WeekDots } from '../progress/WeekDots.js';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
import { moreSessions } from './Progress.js';

export function Home() {
  const { api, active } = usePlayers();
  const [data, setData] = useState<{
    sessions: CompletedSession[];
    summary: ProgressSummary;
  } | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    Promise.all([api.listSessions(), api.getProgress()])
      .then(
        ([sessions, progress]) => !cancelled && setData({ sessions, summary: progress.summary }),
      )
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <section>
      <h1>Hi, {active?.name}</h1>
      <p className="lead">A three-minute focus check. Catch every 3, keep a steady rhythm.</p>
      {data && (
        <Card>
          <WeekDots completedAt={data.sessions.map((s) => s.completedAt)} />
          <p>Sessions completed: {data.sessions.length}</p>
          {data.summary.sessionsUntilBaseline > 0 && (
            <p>{moreSessions(data.summary.sessionsUntilBaseline)} until your starting point</p>
          )}
        </Card>
      )}
      <Button to="/play" size="lg">
        Start today&apos;s check
      </Button>
    </section>
  );
}
