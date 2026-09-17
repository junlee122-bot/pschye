# Sixth batch: petal-training browser verification

## Source preparation

- Ignored repository fixture `tmp/sixth-batch-review/{index.html,review.tsx,seeds.ts,build.mjs}` imports the real App and styles.
- Only new origin `http://127.0.0.1:4402` can mount App or call save APIs. Test slot1 only; seed baseline kept in this origin's sessionStorage.
- Separate fixture build output `tmp/sixth-batch-review/dist`; server source `work/sixth-batch-server.mjs` reads it with a read-only production dist fallback for public assets.
- The separate fixture build began after the production build completed. Actual observations and cleanup are recorded below.

## Seeds and boundaries

The start is currentSceneId sixteen-petals with the earlier10 scene IDs in completedSceneIds. This is explicit setup, not a played origin story. Earlier village rescue and field exam states are absent rather than fabricated; their completion is not being verified by this fixture.

- choice: no current choice or training state, enabling actual story choice UI.
- failed: actual step-beyond-fall choice/start, then trace→trace→balance→trace. Expected attempt1/turn4/petals16/burden8/failed; failure must take precedence over reaching16.
- review: actual distribute-weight choice/start followed by six balance actions. Expected attempt1/turn6/petals16/burden6/review. Completion is not invoked.

No training phase or numeric progress is assigned directly. Every seed uses actual save/load APIs and checks scene/choice/training preservation before App mounting. The inspection includes score, Maru affinity/facts, bondLevels, heroProgress, derived hero HP/armor/skill values, and resources for comparisons.

## Verification procedure

1. Fresh4402 tab; choice seed only, then actual insight choice and start.
2. Keyboard-select balance and submit through the form. Verify exactly one action and cleared selection.
3. Title exit → browser reload → continue. Compare full saved summary and progress.
4. Execute five more balance actions via actual UI, reach review and verify result flag/fact still absent.
5. Actual Maru completion → captain-trials navigation. Compare score7, Maru affinity2, no Maru bond, no extra XP/hero-stat/resources changes.
6. Use the failed API seed once. Observe petals16/burden8 with failure UI, then actual retry; distinguish seed failure from direct UI retry.
7. Capture390px form/completion screenshots, DOM widths, actual save summaries and bounded warn/error logs. Only one manual route is planned; core tests remain separate.
8. At recurring CUA errors, reconnect once then stop and record the limit. No lower-level browser bypass. Restore viewport and stop this server.

## Completed browser verification (2026-09-15T00:39:02.582Z)

- Source commit: f8ae64b. Root confirmed no production source change after fixture build. Production entry index-CUmyZMq6.js / PetalTrainingEncounter-vFRe0c2n.js. Separate fixture entry index-CNNWrG5Y.js / PetalTrainingEncounter-BXB2Tg3f.js; shared CSS PetalTrainingEncounter-BapYr2BC.css. Root's 312 tests, tsc, ESLint and production build are separate automatic evidence.
- Root build-complete signal received before separate fixture build. Fixture build finished in 1m32s. Fresh Edge tab1908172958 on isolated4402; no transport failure during this run.
- Actual UI: choice seed → distribute-weight choice → start → trace radio focus/Right to balance/Tab/Enter → turn1 petals3 burden1 → title → actual reload → continue. Full saved summary before/after resume is identical.
- Actual UI: five further balance submissions → review turn6 petals16 burden6. At review, flags remain empty and Maru has only the chosen-method fact. Actual Maru finish → complete → actual captain-trials navigation displayed scene12, 재능이 예상하지 못한 검 and 최종 조장 선발전.
- Final actual save: score7, Maru affinity2, bondLevels{}, petals-distributed flag, completion fact. Hero progress including XP/equipment, derived HP/armor/skills, and resources equal the choice-before baseline.
- Failed setup is an API seed (not four UI actions): step-beyond-fall trace/trace/balance/trace → attempt1/turn4/petals16/burden8/failed. UI explicitly says 잠시 멈춤, 이어지려던 궤적이 끊겼습니다, 부담이 한계에 닿았습니다. Actual 쉬고 다시 연습 produces attempt2/active/turn0/petals0/burden0; score/affinity/hero state/resources unchanged.
- 390px form, complete and garden screenshots saved. All DOM metrics: innerWidth390; clientWidth/scrollWidth/body.scrollWidth381. Visual review found no horizontal clipping of tested content. Garden screenshot is after actual retry, showing second practice at0/16.
- Recent warn/error log query(limit12): []. This is bounded evidence, not a blanket assertion about all browser logs.
- Main route is one actual manual completion. Other two training routes and320px are untested manually. Earlier10 scenes are setup; earlier field-exam/rescue outcomes are absent. Prior field-exam rescue-team/defy-order manual paths and village Kazrin return remain outside this result.
- Cleanup: viewport.reset() succeeded. Own server session5238 stopped with Ctrl-C (exit1). Loopback port4402 closed=true. No original user storage, src or dist modification, or other process termination.

Artifacts: sixth-batch-browser-result.json, sixth-batch-browser-save-evidence.json, sixth-batch-browser-form-390.png, sixth-batch-browser-complete-390.png, sixth-batch-browser-garden-390.png, all under current workspace work.
