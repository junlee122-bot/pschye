# Fourth batch: battle persistence browser review

## Source preparation (2026-09-14)

- Owner: lore_asset_audit. Source only; no fixture build, server, or browser started. Wait for root production build completion before execution.
- Fixture: repository `tmp/fourth-batch-review/{index.html,review.tsx,seeds.ts,build.mjs}` (ignored). Uses the real App and global styles.
- Isolated origin: `http://127.0.0.1:4397`; fixture refuses to mount App or access save APIs on other origins. Test slot 1 only at this new origin. Seed baseline is kept in that origin's sessionStorage.
- Server source: task workspace `work/fourth-batch-server.mjs`; primary root is the fixture's own build directory, with read-only fallback to production dist for public assets. It is not running.
- Final code commit/build basis will be recorded after root gives the production-ready signal.

## Seeds and evidence boundaries

All seeds directly prepare origin completion for the first mission. This does not verify an origin-story playthrough. Real `chooseRaonStoryPath` and `beginCampaignBattle` then establish a six-hero frozen deployment, shelter doctrine, story difficulty, resolve stance.

1. Ready: no battle attempt; campaign preparation screen.
2. Select: actual battle attempt before choosing tactical/action, opens at title.
3. Tactical: actual `applyHeroSkill` calls for Hadori's iron-gate and Chris's side-read, with both prior states in the actual checkpoint undo history.
4. Action initial: actual model and initial checkpoint, for direct UI command/save/exit verification.
5. Action values: actual initial/restore/capture serializer. Companion guard and incoming damage use actual action rules. The coordinates (382,389), elapsed 1.25 s, heavy cooldown 900 ms and Hadori cooldown 7800 ms are explicit fixture values; this is not a recorded Phaser play session.
6. Victory: legal real-engine skills, finisher and end-turn calls choose actions until victory; no manual outcome or HP overrides, and no settlement call. Failure to reach victory is a fixture error, not a passed test. App hydration is expected to settle this pending victory once.

Each seed uses actual save/load APIs and checks the attempt ID after reading back. The panel displays the pre-mount baseline separately from the latest loaded save. No browser interaction has been verified at this stage.

## Planned browser checks

- Title → explicit resume/result control; frozen mission and mode agree with the seed.
- Tactical saved two actions → actual undo → save-and-exit → reload → resume; compare command points, shield, exposed enemy and history depth.
- Action initial → actual companion command and a movement/action if CUA permits → save-and-exit → reload → resume. Compare the actual captured elapsed, HP, coordinates and cooldowns before resuming simulation. Separately verify the action-values seed while paused.
- Pending victory → inspect settlement resources/XP/completed mission → reload → identical rewards and settled status.
- 390 px viewport: resume card, mode selection and action pause/resume controls visible with no horizontal overflow. 320 px only if time and CUA stability allow.
- Record seed-based checks separately from actual UI play. End after two consecutive CUA failures; do not claim unobserved paths passed. Reset viewport and stop only this fixture server when finished.

## Execution result (2026-09-14 11:08:38 UTC)

- Completed production fixture build (32.20 seconds), source base `2b9df5d` plus then-uncommitted fourth batch. Fixture entry `index-BhNsPk2c.js`, action chunk `RaonActionBattle-D6ojTgna.js`. Original production dist was not changed.
- Root subsequently committed final code as `fd9b941`, with final production entry `index-BuR2u4ip.js` and action `RaonActionBattle-CSbZ9E6z.js`. The later difference is progression.ts removing an old settled attempt when changing a choice for that same mission. Root verified that edge through 3 added regressions / 239 total tests; this browser snapshot does not verify it.
- Tactical: actual title resume → undo → save/exit → reload → resume succeeded. Direct saved values after first undo: command3, morale32, history1, sniperHP117/hidden/exposure0. Reloaded screen agreed; a second actual undo then exit showed shield26 instead of63. The second undo's exact command/history values were not separately sampled.
- Action: saved-value seed resumed paused with HP115/139, morale32, shield63. Actual resume and Leo order raised shield by40 and morale by14. After real pause, resume, save/exit and reload, the entire battle/action save objects were identical: elapsed8.600219999408719s, HP97, x382/y389, Leo cooldown5422.3466669003155ms, Hadori449.78000059128135ms. Reloaded paused HUD showed HP97, morale46, shield85. The single mobile right click did not change coordinates, so continuous movement/hold is not verified.
- Victory: real-engine seed reached victory in round2 without HP/outcome overrides. App settled supplies320→410, intel40→70, relics0→1, renown0→45, RaonXP8→78; completed mission1, careerMissions1. Actual result viewing and reload left the entire sampled profile summary identical.
- Mobile390: Hub card client/scroll381/381, action resume guide390/390 and visible controls. Both screenshots are clear. Victory result itself is visible, but underlay battle-page is left-14/width408.8/right394.8 and document client381/scroll395: 14px horizontal overflow remains. First-settlement result also displays the generic replay-only-rewards text, despite proper reward credit. Root informed; no source edits here.
- CUA runtime had one early DOM result read before async inspection finished, plus one no_matches locator for the details summary. AX-index fallback succeeded. No recurring transport failure. Final warn/error latest12 query returned `[]`; that is only a bounded log observation.
- Cleanup: viewport reset succeeded. Only this agent's server57779 was stopped with Ctrl+C (exit1); no server remains from this run. Existing user origin/storage untouched.
- Structured report: `work/fourth-batch-browser-battle-result.json`. Screenshot and numeric evidence paths are listed there.

## Final UI follow-up (2026-09-14 11:11:55 UTC)

- Root fixed the two observed display issues: battle-page's old negative margin is reset under app-main-battle (`styles.css:10428`), and result text now explains that resources/XP are awarded once while replay can update grade and new witness records (`BattleScreen.tsx:627`).
- Final fixture rebuild succeeded in47.95s: entry `index-CVRbMALL.js`, action `RaonActionBattle-BUSutGAE.js`, CSS `index-CUmxpurm.css`. Source basis is `fd9b941` plus those two UI lines; this includes the settled-choice cleanup. Root's final local commit is `c3a1c93`, production entry `index-D03iHl_W.js`, action `RaonActionBattle-DoyZQKwL.js`.
- Server restarted as session77866. Attempting viewport set/reload on existing tab1908172948 returned `Debugger is not attached`. Inventory still listed the isolated tab. One `getTab` reattachment attempt returned the same error; following the agreed limit, verification stopped without opening another tab.
- A viewport-reset cleanup attempt also returned the debugger error. The initial run's reset succeeded; this follow-up's set/reset execution could not be confirmed. Server77866 was stopped with Ctrl+C, exit1. No server remains from this agent.
- Final UI fixes are source/build verified, browser recheck incomplete. The screenshots and tactical/action/settlement observations above remain evidence for the prior snapshot and must not be presented as post-fix screenshots.
