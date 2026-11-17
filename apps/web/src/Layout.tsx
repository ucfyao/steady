import { useLayoutEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useMatch, useOutletContext } from 'react-router';
import type { Variant } from '@steady/core';
import { VariantBadge } from './dev/VariantBadge.js';
import { PlayerMenu } from './PlayerMenu.js';
import { ThemeToggle } from './theme/ThemeToggle.js';
import { usePlayers } from './players/usePlayers.js';
import { Button } from './ui/Button.js';
import { Notice } from './ui/Notice.js';
import styles from './Layout.module.css';

type LayoutContext = { setFocusMode(on: boolean): void };

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

/** `devTools`: the development version badge (Spec 011), never in a production build. */
export function Layout({ devTools }: { devTools?: { override?: Variant } } = {}) {
  const { status, error, retry, notice, dismissNotice, active } = usePlayers();
  const [focusMode, setFocusMode] = useState(false);
  const outletContext = useMemo<LayoutContext>(() => ({ setFocusMode }), []);
  // Spec 013: on Home the header lies on the night scene, unless a notice sits between them.
  const onHome = useMatch('/') !== null;
  const overHero = onHome && status === 'ready' && !notice;

  return (
    <div className={styles.app} data-over-hero={overHero || undefined}>
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

      {/* `import.meta.env.DEV` first, so a production build drops the badge entirely. */}
      {import.meta.env.DEV && devTools && status === 'ready' && !focusMode && (
        <VariantBadge key={active!.id} override={devTools.override} />
      )}
    </div>
  );
}
