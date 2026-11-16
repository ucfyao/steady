import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no showModal/close yet. This stand-in keeps the part tests depend on: while a
// modal is open, the rest of the page is inert and cannot take focus.
if (!HTMLDialogElement.prototype.showModal) {
  const modals = new Set<HTMLDialogElement>();
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
    modals.add(this);
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    modals.delete(this);
    this.dispatchEvent(new Event('close'));
  };
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
    const open = [...modals].filter((d) => d.isConnected);
    if (open.length && !open.some((d) => d.contains(this))) return;
    focus.call(this, options);
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
