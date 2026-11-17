import { BrowserRouter, Route, Routes } from 'react-router';
import { STARTUP_OVERRIDE, type PlayEnv } from './game/env.js';
import { Layout } from './Layout.js';
import { PlayersProvider } from './players/PlayersProvider.js';
import { Home } from './screens/Home.js';
import { Import } from './screens/Import.js';
import { NotFound } from './screens/NotFound.js';
import { Play } from './screens/Play.js';
import { Players } from './screens/Players.js';
import { Progress } from './screens/Progress.js';
import { Results } from './screens/Results.js';

/**
 * `playEnv` lets tests drive the game with a fake clock. `devTools` shows the development
 * version badge (Spec 011) with the override this app plays.
 */
export function AppRoutes({ playEnv, devTools }: { playEnv?: PlayEnv; devTools?: boolean } = {}) {
  const override = playEnv ? playEnv.variantOverride : STARTUP_OVERRIDE;
  return (
    <Routes>
      <Route element={<Layout devTools={devTools ? { override } : undefined} />}>
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
        <AppRoutes devTools={import.meta.env.DEV} />
      </BrowserRouter>
    </PlayersProvider>
  );
}
