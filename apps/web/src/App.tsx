import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './Layout.js';
import { PlayersProvider } from './players/PlayersProvider.js';
import { Home } from './screens/Home.js';
import { YourData } from './screens/YourData.js';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="data" element={<YourData />} />
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
