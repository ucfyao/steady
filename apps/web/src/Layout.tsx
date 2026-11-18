import { useLayoutEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router';
import { Scene } from './game/Scene.js';
import { PlayerMenu } from './PlayerMenu.js';
import { ThemeToggle } from './theme/ThemeToggle.js';
import { usePlayers } from './players/usePlayers.js';
import { Button } from './ui/Button.js';
import { Notice } from './ui/Notice.js';
import styles from './Layout.module.css';

type LayoutContext = {
  setFocusMode(on: boolean): void;
  setSceneDawn(dawn: number | null): void;
};

/**
 * Focus mode (Spec 004): while a screen calls this, the layout drops the header and
 * notices, so only that screen is on the page. Turns off when the caller unmounts.
 * A layout effect, so the header is gone before the first frame is painted.
 */
export function useFocusMode() {
  const setFocusMode = useOutletContext<LayoutContext | undefined>()?.setFocusMode;
  useLayoutEffect(() => {
    if (!setFocusMode) return;
    setFocusMode(true);
    return () => setFocusMode(false);
  }, [setFocusMode]);
}

/**
 * The scene behind the page (Spec 026, Spec 028): while a screen calls this with a dawn
 * (0–100), the layout draws Home's scene fixed behind the whole window at that dawn, and the
 * header lies on it. `null` draws nothing. A layout effect, so it is set before the first
 * paint; it ends when the caller unmounts or passes null.
 */
export function useScene(dawn: number | null) {
  const setSceneDawn = useOutletContext<LayoutContext | undefined>()?.setSceneDawn;
  useLayoutEffect(() => {
    if (!setSceneDawn || dawn === null) return;
    setSceneDawn(dawn);
    return () => setSceneDawn(null);
  }, [setSceneDawn, dawn]);
}

export function Layout() {
  const { status, error, retry, notice, dismissNotice, active } = usePlayers();
  const [focusMode, setFocusMode] = useState(false);
  const [sceneDawn, setSceneDawn] = useState<number | null>(null);
  const outletContext = useMemo<LayoutContext>(() => ({ setFocusMode, setSceneDawn }), []);
  // Spec 028: calm's and game's scene behind the page, outside focus mode (which draws its own).
  const onScene = sceneDawn !== null && !focusMode;

  return (
    <div className={styles.app} data-scene={onScene || undefined}>
      {onScene && (
        <div className={styles.pageScene} data-testid="page-scene">
          <Scene rich ref={(el) => el?.style.setProperty('--dawn', (sceneDawn / 100).toFixed(3))} />
        </div>
      )}
      {!focusMode && (
        <header className={[styles.header, onScene && styles.onScene].filter(Boolean).join(' ')}>
          <NavLink to="/" className={styles.brand}>
            Steady
          </NavLink>
          <div className={styles.headerEnd}>
            <nav aria-label="Main">
              <NavLink to="/progress" className={styles.navLink}>
                Trends
              </NavLink>
            </nav>
            <ThemeToggle />
            {status === 'ready' && <PlayerMenu />}
          </div>
        </header>
      )}

      {notice && !focusMode && <Notice onDismiss={dismissNotice}>{notice}</Notice>}

      <main>
        {status === 'loading' && <p>Setting up…</p>}
        {status === 'error' && (
          <div role="alert" className="error">
            <p>{error}</p>
            <Button onClick={retry}>Try again</Button>
          </div>
        )}
        {/* Keyed by player: switching or deleting a player remounts every screen, so no
            screen can carry over another player's data or an open confirmation. */}
        {status === 'ready' && <Outlet key={active!.id} context={outletContext} />}
      </main>
    </div>
  );
}
