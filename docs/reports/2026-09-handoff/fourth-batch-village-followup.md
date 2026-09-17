# Fourth batch browser notes — village return

- Date: 2026-09-14 (Asia/Seoul).
- HEAD: `2b9df5d5190c457a26d3d8a3385c0eaad23e4e4c`, clean when verification started.
- Confirmed `git diff d83c9d2 HEAD --stat` changes only `docs/VILLAGE_PLAYABLE_LOOP.md`. Reused the prior production fixture whose application code matches `d83c9d2`; no rebuild or original dist modification.
- Fixture: ignored `tmp/third-batch-review/`, real App, entry `index-Wxcxb7NC.js`.
- Origin: `http://127.0.0.1:4396` only. Inventory was queried once before opening a fresh test tab. Existing user PDF tab was not inspected or changed.
- Server session: `16538`; stopped with Ctrl+C after verification (exit code 1).

## Actual confirmations

1. Explicitly used the **return seed**, not a fresh rescue run and not the near-return seed. Starting state: phase return, turn 9, HP 2, progress 3; village position `(932,548)` at the waterway.
2. Set a 390×844 mobile viewport. Clicked the actual mobile up button five times. The fixture's read-only save inspector reported local return save at `(932,408)`.
3. Clicked the actual mobile left button fourteen times along the path above the collision zone. The real “카즈린과 무사 귀환을 확인한다” interaction button appeared. No coordinates were changed through the fixture after step 1.
4. Reloaded the browser, waited for actual slot hydration, and read the save inspector. The return phase and position `(540,408)` were restored. The same interaction button was visible after reload. This confirms real walking into Kazrin's proximity and return-position persistence.

## Limits and interruption

- Three brief Right key presses before opening the dialogue did not change the saved coordinates. These short key pulses do not establish sustained Phaser keyboard movement, so they are not evidence that dialogue-time input locking works. No supported hold operation was used.
- After closing the fixture panel and clicking the real Kazrin interaction, CUA returned `Input.dispatchMouseEvent` timeout (1819ms).
- One read-only AX call to determine whether the click completed then returned `DOMSnapshot.captureSnapshot` timeout (10000ms). Two consecutive failures ended the attempt; no repeated recovery loop followed.
- **Not verified:** whether the dialogue opened, confirming safe return, advancing to the next recruiter-announcement scene, dialogue-time keyboard movement blocking, mobile hold behavior. Do not mark these checklist items complete.
- Temporary viewport reset succeeded during cleanup. The server was stopped. No application source, original documentation, real-user saves, other browser tabs, commits or deployments were changed.
