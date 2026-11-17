import { useLayoutEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useMatch, useOutletContext } from 'react-router';
import { Scene } from './game/Scene.js';
import { PlayerMenu } from './PlayerMenu.js';
import { ThemeToggle } from './theme/ThemeToggle.js';
import { usePlayers } from './players/usePlayers.js';
import { Button } from './ui/Button.js';
import { Notice } from './ui/Notice.js';
import styles from './Layout.module.css';

type LayoutContext = { setFocusMode(on: boolean): void; setNight(on: boolean): void };

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
 * The night look (Spec 015): while a screen calls this with `on`, the page takes the night
 * colours over the focus-mode scene. A layout effect, so it is set before the first paint;
 * it ends when the caller unmounts or passes false.
 */
export function useNightPage(on: boolean) {
  const setNight = useOutletContext<LayoutContext | undefined>()?.setNight;
  useLayoutEffect(() => {
    if (!setNight || !on) return;
    setNight(true);
    return () => setNight(false);
  }, [setNight, on]);
}

export function Layout() {
  const { status, error, retry, notice, dismissNotice, active } = usePlayers();
  const [focusMode, setFocusMode] = useState(false);
  const [night, setNight] = useState(false);
  const outletContext = useMemo<LayoutContext>(() => ({ setFocusMode, setNight }), []);
  // Spec 014: on Home the header lies on the night scene, unless a notice sits between them.
  const onHome = useMatch('/') !== null;
  const overHero = onHome && status === 'ready' && !notice;

  return (
    <div
      className={styles.app}
      data-over-hero={overHero || undefined}
      data-night={night || undefined}
    >
      {/* Focus mode draws its own scene over everything, so this one rests meanwhile. */}
      {night && !focusMode && (
        <div className={styles.nightScene} data-testid="night-scene">
          <Scene />
        </div>
      )}
      {!focusMode && (
        <header className={overHero ? `${styles.header} ${styles.overHero}` : styles.header}>
          <NavLink to="/" className={styles.brand}>
            Steady
          </NavLink>
          <div className={styles.headerEnd}>
            <nav aria-label="Main">
              <NavLink to="/progress" className={styles.navLink}>
                Progress
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
