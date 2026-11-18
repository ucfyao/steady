# Spec 027: One group per player, on every screen

Status: implemented
Design note: `docs/design-note.md` §3
Depends on: Spec 006, Spec 008, Spec 011
Changes: Spec 006 §5 (no play-test override), Spec 008 §2, Spec 011 §1, Spec 015 §1, Spec 026 §2

## Why

Two things decided which group's look a browser showed (found 2026-11-18):

1. **The `?variant=` override** (Spec 006 §5), read once when the app opened. Only the check followed it: "How it works", practice and the session, and Results through the session it recorded. Home, Trends and the group tag in the avatar menu kept the player's own group.
2. **The player's group**, through switching players (Spec 011).

With `?variant=game` and a calm player, Home was calm, the check was game, Results was game, and Home was calm again. After switching to a plain player, Home was plain and the check was still game, because the override applied to every player in this browser. The override also recorded sessions in a group other than the player's, so a player's history no longer came from one variant (Spec 006 §5, "Sticky").

Switching players already shows the whole experience of a group (Spec 011), and in development a new player can be created in a chosen group. The override is removed.

## 1. The rule [P]

- **A session's variant is always its player's group.** The group is chosen when the player is created (Spec 006 §5, Spec 011 §3) and never changes.
- Every screen follows the player's group: Home, the check, Results, Trends, and the group tag.
- To see another group, switch to (or add) a player in that group.

## 2. What is removed

- Web: the `?variant=` override. The address no longer changes anything.
- API: `POST /api/sessions` no longer takes `variant`. Like any other unknown field, it is dropped (the request is not rejected), and the session gets the player's group.

## 3. Comparison

Sessions already recorded with an override keep their stored `sessions.variant`. From now on every new session is in its player's group, so a player's sessions come from one variant.

## Test cases

- Core: `StartSessionSchema` drops `variant`.
- API: a session started with a `variant` other than the player's group is recorded, and returned, in the player's group.
- Web: starting a session sends no `variant`.
