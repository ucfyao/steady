import { useLayoutEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useMatch, useOutletContext } from 'react-router';
import { Scene } from './game/Scene.js';
import { PlayerMenu } from './PlayerMenu.js';
import { ThemeToggle } from './theme/ThemeToggle.js';
import { usePlayers } from './players/usePlayers.js';
import { Button } from './ui/Button.js';
import { Notice } from './ui/Notice.js';
import styles from './Layout.module.css';

type LayoutContext = {
  setFocusMode(on: boolean): void;
  setCheckDawn(dawn: number | null): void;
  setOverHero(on: boolean): void;
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
 * The check's scene (Spec 023): while a screen calls this with a dawn (0–100), the layout
 * draws Home's scene behind the whole window at that dawn, and the header lies on it. `null`
 * draws nothing. A layout effect, so it is set before the first paint; it ends when the
 * caller unmounts or passes null.
 */
export function useCheckScene(dawn: number | null) {
  const setCheckDawn = useOutletContext<LayoutContext | undefined>()?.setCheckDawn;
  useLayoutEffect(() => {
    if (!setCheckDawn || dawn === null) return;
    setCheckDawn(dawn);
    return () => setCheckDawn(null);
  }, [setCheckDawn, dawn]);
}

/**
 * A scene at the top of the page (Spec 018): while a screen calls this with `on`, the header
 * lies on it, as on Home (Spec 014). A layout effect, so the header is in place before the
 * first paint; it ends when the caller unmounts or passes false.
 */
export function useOverHero(on: boolean) {
  const setOverHero = useOutletContext<LayoutContext | undefined>()?.setOverHero;
  useLayoutEffect(() => {
    if (!setOverHero || !on) return;
    setOverHero(true);
    return () => setOverHero(false);
  }, [setOverHero, on]);
}

export function Layout() {
  const { status, error, retry, notice, dismissNotice, active } = usePlayers();
  const [focusMode, setFocusMode] = useState(false);
  const [checkDawn, setCheckDawn] = useState<number | null>(null);
  const [sceneOnTop, setOverHero] = useState(false);
  const outletContext = useMemo<LayoutContext>(
    () => ({ setFocusMode, setCheckDawn, setOverHero }),
    [],
  );
  // Spec 014 and 018: the header lies on the scene at the top of Home, or of a screen that asks
  // for it, unless a notice sits between them.
  const onHome = useMatch('/') !== null;
  const overHero = (onHome || sceneOnTop) && status === 'ready' && !notice;
  // Spec 023: the check's scene for calm and game, behind the page outside focus mode.
  const onScene = checkDawn !== null && !focusMode;

  return (
    <div className={styles.app} data-over-hero={overHero || undefined}>
      {/* Focus mode draws its own scene over everything, so this one rests meanwhile. */}
      {checkDawn !== null && !focusMode && (
        <div className={styles.checkScene} data-testid="check-scene">
          <Scene rich ref={(el) => el?.style.setProperty('--dawn', (checkDawn / 100).toFixed(3))} />
        </div>
      )}
      {!focusMode && (
        <header
          className={[
            styles.header,
            overHero && styles.overHero,
            onScene && !overHero && styles.onScene,
          ]
            .filter(Boolean)
            .join(' ')}
        >
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
