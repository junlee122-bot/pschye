# Third batch browser notes

- Date: 2026-09-14 (Asia/Seoul)
- Initial target HEAD: `ebdc906b1d34aa8812bf859c80a5ca55a35e8d36`
- Initial working tree: clean.
- Scope: short production-build verification of mobile action onboarding overflow and player-journal spoiler boundaries. Original src files remain untouched.
- Fixture: existing ignored `tmp/first-batch-review/`, actual App plus production Vite build.
- Isolated origin: `http://127.0.0.1:4395`; no real-user save origin accessed.
- Server process session: `95047`; stopped with Ctrl+C after bounded browser verification.
- Fixture build process session: `1286`; production build succeeded in 57.83 seconds, large-chunk warning only.
- Built entry: `index-Br1Yu6yM.js`; CSS `index-DnOgE78Q.css`; action component `RaonActionBattle-DNrkTha3.js`.
- CUA Edge connection inventory succeeded. Existing user PDF tab was not inspected or changed.

## Verified

1. Actual fixture App loaded from production build. Initial isolated slot 1 retained the prior test profile: DAY 20, origin completed, zero completed missions.
2. Switched through visible UI to previously empty isolated slot 2. Title changed to DAY 1, first origin scene, zero missions, no path selected. This exercised real slot hydration from a progressed test profile to a fresh one.
3. Opened “만난 사람” through the title button. The actual codex displayed `01 RECORDS FOUND`: Raon only, public role “변방 마을의 소년”, weapon “훈련용 검”, style “수련 중”. No later characters or author-ending descriptions appeared in the rendered accessibility tree.
4. Navigation buttons for world, activities, roster, headquarters were disabled and labeled “입단 후 열림” in this fresh profile.

## Limitations

- Clicking Raon's visible record timed out: CDP `Input.dispatchMouseEvent`, 2996ms.
- A single read-only AX state call to establish whether navigation completed then timed out: CDP `Page.getFrameTree`, 10000ms.
- Two consecutive CUA failures ended this attempt. No repeated click/recovery loop, browser restart, or alternative browser automation was used.
- **Not verified:** mobile action onboarding overflow fix, journal search/testimony blocking, detail truth tab, profile downgrade while a detail is open, direct query author gate. The initial codex and slot switch observations above are the only new UI confirmations.
- No screenshot artifact was captured in this attempt. The previous mobile overflow issue therefore remains unverified in a browser despite the source fix.
- No original application source edits, commits, deployment, new automated tests, real-user save changes, or user browser-tab changes were made. Only the isolated test slot and verification fixture build were used.

## New river rescue UI review and second bounded attempt

- Read-only source review: `VillageRescueEncounter.tsx`, `VillagePrologue.css`, `VillageAdventure.tsx`, current App integration, rescue rules/progression. No additional important defect found. This is not a browser pass.
- Mobile 320/390 reasoning: the <=500px rules remove the floated pad, use one column, zero minimum button width and 100% widths. Rescue board uses five `minmax(0,1fr)` tracks. Actual geometry still requires browser measurement.
- Phaser `update` and virtual movement check `inputLocked`; native rescue keys and visible buttons call the same validated action reducer. Displayed rows/columns use one-based values consistently.
- Return confirmation flushes the latest position before its functional profile update. Title/dialogue opening request live position broadcast; pending throttled saves are cancelled on unmount. Ready/active/return/complete text agrees with state in the reviewed source.
- Prepared ignored `tmp/third-batch-review/` fixture with real App and actual progression/reducer-driven ready, active, one-action-before-return, return-map and near-return-confirmation seeds. Writes are restricted to `http://127.0.0.1:4396`.
- Build base is `ebdc906` plus the root's uncommitted third-batch rescue changes. This differs from the clean-HEAD first attempt above.
- Separate fixture output directory: `tmp/third-batch-review/dist`; original production `dist` is preserved. Server will read fixture output first and production static assets only as fallback.
- Build session `16919` succeeded in 27.09 seconds. Root subsequently committed the unchanged reviewed source as `d83c9d2`.
- Fixture entry `index-Wxcxb7NC.js`; rescue chunk `VillageRescueEncounter-BDh0U6Kp.js`; village chunk `VillageAdventure-Cj9GQY6b.js`; rescue CSS `VillagePrologue-DpY55hrw.css`.
- Isolated server session `49448`, port 4396. Stopped with Ctrl+C after verification (exit code 1).

### Actual browser results for the new rescue UI

1. Seeded only the real-engine `active` initial state: turn 0, HP 5, progress 0, internal grid position (0,1), village position (932,548). All subsequent rescue progress was performed through actual UI; return/near-return seed buttons were not used.
2. Clicked the visible right-move button once, then pressed Right twice. UI advanced to turn 3, HP 4, progress 0, row 2 / column 4. Damage and threat-row changes agreed with the rules.
3. Reloaded the page through the browser API. After real save hydration, the same turn 3, HP 4, progress 0, row 2 / column 4 and action log were restored.
4. Set viewport to 390×844. Screenshot showed readable objective, stats, all 15 grid cells and the scrollable action panel. Read-only DOM measurement returned `innerWidth:390`, `clientWidth:381`, `scrollWidth:381`, `bodyScrollWidth:381`: no horizontal overflow.
5. Pressed E three times in the real rescue encounter. UI showed turn 6, HP 3, rescue 3/3, disabled assist, child “안전 확보”, and “아이는 안전하다. 라온도 1열로 돌아가자.”
6. Pressed Left three times. The actual state transitioned out of the encounter into the village. After asset loading, the Phaser map rendered and the objective was “공동회관 앞 카즈린에게 돌아가 구출 결과를 확인한다”, with “아이 안전 확보” status. This was actual escape, not a seeded return state.
7. Pressed the mobile up-move button five times to begin walking back. The next fixture-panel click failed with `Debugger is not attached to the tab with id: 1908172944`. A single read-only AX recovery observation returned the same error. No further traversal or recovery loop was attempted.
8. Before the disconnection, warning/error log query returned an empty array. This does not certify all future execution.

### Evidence files

- `work/third-batch-rescue-mobile-390.png`: saved screenshot of the actual post-reload rescue at turn 3.
- `work/third-batch-return-mobile-390.png`: saved screenshot of the actual rendered return village after successful escape.

### Remaining limitations and cleanup

- Not verified: reaching Kazrin by walking, final return confirmation, scene advance to recruiters, reload of the return position, dialogue-time keyboard blocking in the browser, failure/retry, other two rescue choices, 320px viewport.
- Source review covered those input/state branches without identifying an additional important defect, but it is not an executed UI pass.
- Temporary viewport reset was attempted during cleanup and also returned “Debugger is not attached”; restoration could not be confirmed. No other browser tabs or user processes were changed.
- Port 4396 server session `49448` is stopped. Original application source and documentation were not edited by this reviewer.


## Saved review images

- [수로 구출 390px](%EC%88%98%EB%A1%9C%EA%B5%AC%EC%B6%9C_%EB%AA%A8%EB%B0%94%EC%9D%BC390.png)
- [수로 귀환 지도 390px](%EC%88%98%EB%A1%9C%EA%B7%80%ED%99%98_%EB%AA%A8%EB%B0%94%EC%9D%BC390.png)

Final commit 2b9df5d5190c457a26d3d8a3385c0eaad23e4e4c adds the observed browser results to the checklist; application code is identical to the reviewed d83c9d2 build.
