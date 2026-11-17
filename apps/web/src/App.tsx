import { BrowserRouter, Route, Routes } from 'react-router';
import { DevToolsContext } from './dev/devTools.js';
import type { PlayEnv } from './game/env.js';
import { Layout } from './Layout.js';
import { PlayersProvider } from './players/PlayersProvider.js';
import { Home } from './screens/Home.js';
import { NotFound } from './screens/NotFound.js';
import { Play } from './screens/Play.js';
import { Players } from './screens/Players.js';
import { Progress } from './screens/Progress.js';
import { Results } from './screens/Results.js';

/**
 * `playEnv` lets tests drive the game with a fake clock. `devTools` turns on the development
 * tools (Spec 011): each player's group in the player menu and on Manage players.
 */
export function AppRoutes({ playEnv, devTools }: { playEnv?: PlayEnv; devTools?: boolean } = {}) {
  return (
    <DevToolsContext.Provider value={!!devTools}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="play" element={<Play env={playEnv} />} />
          <Route path="results/:id" element={<Results />} />
          <Route path="progress" element={<Progress />} />
          <Route path="players" element={<Players />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </DevToolsContext.Provider>
  );
}

export function App() {
  return (
    <PlayersProvider>
      <BrowserRouter>
        <AppRoutes devTools={import.meta.env.DEV} />
      </BrowserRouter>
    </PlayersProvider>
  );
}
