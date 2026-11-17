# Spec 008: A plain control group

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 006
Changes: Spec 006 §1 (the scene is for calm and game only) and §5 (three groups instead of two)

## Why

Spec 006 changed two things at once for every player: the look of the task (the night scene, the lantern, the frost mask instead of the black `⊗`, the glow after a press) and, for half of them, the game layer. The calm/game split measures only the game layer. Whether the lantern and the frost mask change the speed and rhythm Steady measures cannot be seen, because nobody plays the original screen any more. Themed stimuli can change no-go errors [R] (Lumsden et al. 2016, PeerJ), so this is worth measuring.

A third group, **plain**, plays the focus screen as it was before Spec 006 and is the control for both.

## 1. The plain focus screen

From the countdown to the last trial, the plain variant shows:

- **The paper surface** of the rest of the app (light or dark with the system theme), with no sky, hills, stars or lantern.
- **The digit** on its own in the middle, in the sans face, bold, at the plan's five sizes (the same ratios, a largest size of about 240 px on a desktop). It is drawn straight into the DOM in the frame that becomes its onset (Spec 004), as for the other variants.
- **The mask is the `⊗`** for 900 ms after the 250 ms digit, in the digit's place, as in Spec 004. No frost.
- **No glow** after a press and no other sign that a press counted, as in the original SART.
- **No game layer:** no points, multiplier, fireflies or dawn, and no "Your answer never changes your points." under the probe.
- **The same countdown, practice feedback and probe** as the other variants (Ready, Set, Go with three dots; never a number), in the paper colours.

Everything outside focus mode (Home, Results, Progress) is the same for plain as for calm.

## 2. Three groups [P]

- **Variants:** `plain`, `calm` and `game`.
- **Assignment:** `POST /api/players` puts each new player in one of the three at random (a third each, server-side). Existing players keep their group (sticky, Spec 006 §5); no migration moves them.
- `?variant=plain` works like the other play-test overrides.
- **Comparison** stays between groups, in SQL by `sessions.variant`: plain against calm is the effect of the scene, calm against game the effect of the game layer.
- **Known:** migration 0003 recorded every session played before Spec 006 as `calm`, although those sessions showed the plain screen. They are not relabelled: there was no production data then, and the comparison should use sessions played after this change.

## 3. Tests

- API: new players get all three variants, and `plain` is accepted as an override.
- Web: in the plain variant the focus screen has no scene, lantern, frost, glow or points; the mask is `⊗` in the stimulus; the countdown never shows a digit; Results and Home are as for calm.

## 4. Out of scope

Changing the share of each group, or ending the experiment.
