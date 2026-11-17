import { createContext, useContext } from 'react';

/**
 * Development tools on (Spec 011): `AppRoutes devTools`, which the app sets from
 * `import.meta.env.DEV`. Every use is also guarded by `import.meta.env.DEV`, so a
 * production build drops them.
 */
export const DevToolsContext = createContext(false);

export const useDevTools = () => useContext(DevToolsContext);
