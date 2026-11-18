import { THEME_KEY } from './theme.js';

/**
 * The script `index.html` runs before the page is drawn (Spec 012), so a reload never shows
 * the other scheme first. Built from the same key as the app, so the two cannot disagree.
 */
export function bootScript(): string {
  const key = JSON.stringify(THEME_KEY);
  return `try{var t=localStorage.getItem(${key});if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
}
