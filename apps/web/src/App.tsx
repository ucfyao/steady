import { BrowserRouter, Route, Routes } from 'react-router';
import type { PlayEnv } from './game/env.js';
import { Layout } from './Layout.js';
import { PlayersProvider } from './players/PlayersProvider.js';
import { Home } from './screens/Home.js';
import { Import } from './screens/Import.js';
import { NotFound } from './screens/NotFound.js';
import { Play } from './screens/Play.js';
import { Players } from './screens/Players.js';
import { Progress } from './screens/Progress.js';
import { Results } from './screens/Results.js';

/** `playEnv` lets tests drive the game with a fake clock. */
export function AppRoutes({ playEnv }: { playEnv?: PlayEnv } = {}) {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="play" element={<Play env={playEnv} />} />
        <Route path="results/:id" element={<Results />} />
        <Route path="progress" element={<Progress />} />
        <Route path="players" element={<Players />} />
        <Route path="import" element={<Import />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <PlayersProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </PlayersProvider>
  );
}
