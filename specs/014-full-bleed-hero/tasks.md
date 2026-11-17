# Tasks: Spec 014

- [x] T1 Write spec, plan and tasks
- [x] T2 Failing tests (header over the scene on Home only and not with a notice, the lantern hidden, the new welcome), then the code
- [x] T3 Real-browser look at 375, 768 and 1440 px, light and dark, a high dawn, the avatar menu open (found: the header unreadable at a high dawn, and the cord running through the header)
- [x] T4 Deliberate break (the header over the scene while a notice is shown → a test fails) and `pnpm check`

Revision after the developer's look at 2000 px ("ugly"): a narrow paper column under a full-width scene, an empty sky, and the text and lantern far apart.

- [x] T5 Spec §1–§3 revised: centred composition, one paper across the window, a richer scene on Home only
- [x] T6 Failing test (`Scene` unchanged by default, richer with `rich`), then the code
- [x] T7 Real-browser look at 375, 1440 (dark) and 2000 px, at night and at a high dawn (found: the text wash read as a grey patch at dawn; the welcome left-aligned under a centred hero); `pnpm check`
