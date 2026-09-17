# Eighth batch production journey — intermediate

- Browser baseline: root named commit1d07e4f, original production entry index-B3mm0YSY.js and stylesheet index-CsP1qHx5.css. No fixture App wrapper or seed used. Server87049 reads original dist on new origin4407. Root is preparing later source fixes/build; do not conflate versions.
- New Edge tab1908172964, fresh origin slot1, actual new-game button. Village-dawn loaded with target to find Kazrin. Viewport390x844 shows map, target and four movement buttons.
- Actual mouse right clicks and keyboard activation of mobile movement buttons moved Raon along the road. The first default spawn is blocked to the east by the forge, so one down move and right movement followed. Source geometry only informed route planning; all game movement was actual CUA input.
- During a later batch of sequential movement-button locator.press('Enter'), CDP Input.dispatchKeyEvent timed out after2907ms. Some events in that batch may have applied; exact current coordinates were not read. First Kazrin dialogue not reached, no story choice yet.
- Per root instruction, navigated the SAME tab and origin to /__input-diagnostic once. Actual click increments mouse0→1, trusted/detail1; Tab/Enter increments keyboard0→1, trusted/detail0. DOM and AX confirm. This is a reused diagnostic page with the old4406 title but URL/origin is4407.
- Inference boundary: same-tab lightweight input remains functional; this does not isolate Phaser, React/save workload or intermittent transport as the unique cause. Avoid repeating the same movement batch.
- Bounded recent warn/error log query(limit20) returned[]. No global no-errors claim.
- Evidence: eighth-batch-journey-input-evidence.json, eighth-batch-journey-village-390.png, eighth-batch-journey-control-390.png.
- Current state: diagnostic page, server87049 kept running and390px viewport override kept for ongoing parent-coordinated journey. No final completion claim or cleanup yet.

## Single-input comparison and cleanup (2026-09-15T01:33:39.153Z)

Root authorized one movement per tool call followed by DOM read in the next call, without reconnects. Returned to the saved4407 game route and observed village-dawn. Three right and seven up activations succeeded individually (10 inputs total); the first9 following DOM reads succeeded. The10th following DOM read timed out after3000ms on Page.getFrameTree. Last confirmed scene remained village-dawn before Kazrin dialogue. A preliminary message said about12 steps; the precise count for this comparison is10.

No second control comparison or further movement was attempted. Final viewport reset succeeded. Own server87049 stopped withCtrl-C/exit1 and loopback4407 closed=true. No seed was used in the actual fresh-game journey; exact coordinates were not read. No full story/induction/first mission or320px claim is made. Root's later source build and separate DOM integration checks are separate evidence.

The CUA runtime explicitly says to use cua_repl for UI actions and not other computer-interaction technologies unless the user explicitly requests them. Documented tab.playwright is allowed and used; no rawCDP or separately installed Playwright backend was used.

Final structured result: work/eighth-batch-browser-result.json.
