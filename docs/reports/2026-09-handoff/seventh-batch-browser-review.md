# Seventh batch: captain trials and induction

## Initial preparation record (before production-build signal)

- New isolated origin http://127.0.0.1:4404, slot 1 only. No user-origin storage access.
- Ignored repository fixture tmp/seventh-batch-review imports the real App/styles. Separate build output tmp/seventh-batch-review/dist, emptyOutDir false, copyPublicDir false. The server only reads fixture output and the existing production dist asset fallback.
- Server source: current workspace work/seventh-batch-server.mjs. At this preparation stage no server, fixture build or browser action had started. The completed run and limitations are recorded below.

## Starting setup

CreateNewCampaignProfile → explicitly seed the earlier ten completed scene IDs → actual distribute-weight choice/start/balance six times/complete/advance APIs → captain-trials choice-before. Fresh six-person squad, no campaign missions completed, no battle attempt. Earlier ten scenes and prior rescue/field encounter completion are not manual play evidence. The training setup is real API execution, also not manual play evidence in this batch.

The primary fixture does not preselect or resolve any captain trial. Inspection exposes actual loaded captainTrials, choices, flags, score, affinity/facts, bonds, hero/derived stats, resources, induction records, known missions, first mission choice/launch eligibility and any initial battle attempt. Main-path baseline is preserved in isolated sessionStorage.

## Original planned UI flow (only the opening portion was completed)

1. Choose Kain insight → start → parry,counter,sidestep,counter,parry,counter. After an early command, exit to title → actual reload → continue, compare saved summary. Confirm victory then advance.
2. Choose Kazrin insight → start → sidestep,parry,counter repeated three times. Confirm victory then advance.
3. Hadori ready appears before any response choice → start → challenge once → resolved defeat → confirm infirmary/complete. Only then observe and select the original reaction choice.
4. Seventh oath actual choice → induction → title and reload where appropriate → first mission scene/voices/choice/preparation enabled. If bounded time allows, actual launch to mode selection; do not complete campaign battle.
5. Compare each trial resolution/confirmation for no extra score/affinity/bond/XP/resource reward; compare selection deltas from seed baseline and induction records/rank. Capture390px form and Hadori outcome ordering/first operation readiness, bounded warn/error logs and actual save values.
6. Optional failed seed uses the implemented captainTrialProgression API: choose declare-my-name, start, sidestep/parry/parry → expected turn3/poise0/failed. This is API setup; only retry will count as actual UI observation. Main three-match flow has priority.
7. One CUA reconnect on a transport failure, stop repeated same failure; preserve observation boundaries. Reset viewport and stop own server on completion.

The captain core/UI was still under implementation when these sources were prepared. The core contract was confirmed with its owner and read from captainTrialProgression.ts. getCaptainTrial takes profile only; the other commands include the expected current scene and attempt/turn. Fixture files are git-ignored. The fixture build waited for the root's final production-build signal, as recorded below.

## Browser run ended with bounded tool limitation (2026-09-15T01:09:06.554Z)

- Root production-build-complete signal preceded fixture build. Root production index-B3mm0YSY.js / CaptainTrialEncounter-DxOF0a23.js / CaptainTrialEncounter-K9DEzc1f.css. Separate fixture built in1m5s: index-kY1FeC-J.js / CaptainTrialEncounter-DcjgCGhx.js / same CSS. Base source HEAD at build start f8ae64bde818358353a561952438f1aa9cfc3fbc plus root seventh-batch implementation.
- Fresh Edge tab1908172960, isolated4404/slot1. Choice-before API setup saved and loaded successfully. Actual Kain insight choice produced ready; actual start produced active. Choice-ready save evidence is retained. Selection score delta=8, Kain affinity delta=4.
- First radio click reported CDP Input.dispatchMouseEvent timeout703ms. One getTab reconnect succeeded and showed the radio had been selected. Keyboard Left changed to parry, Tab focused submit, Enter executed exactly first parry. AX after action: turn1, poise6, breath4, progress0, opening/反격 가능. This is UI observation; post-action save reread was not completed.
- Next title-exit click reported the same CDP Input.dispatchMouseEvent timeout1225ms. The click may or may not have applied. Flow stopped per one-reconnect policy. No further gameplay or alternative low-level browser control attempted.
- 390px form screenshot saved. clientWidth/scrollWidth/body.scrollWidth381, innerWidth390. Visual form layout showed no horizontal clipping. No three-match completion, Hadori ordering, induction, first mission preparation/mode-select or optional failed/retry browser claim is made.
- Bounded warn/error query(limit12) returned[]. Tool timeouts are recorded separately; do not infer all errors absent.
- Cleanup: viewport reset succeeded; own server session41909 stopped with Ctrl-C/exit1; port4404 closed=true. No original user storage, source or production dist modification and no other process termination.

Artifacts in workspace work: seventh-batch-browser-result.json, seventh-batch-browser-save-evidence.json, seventh-batch-browser-form-390.png. Prior follow-up cases were not attempted in this batch.

## Authorized keyboard-only alternative

After the first server/viewport cleanup, root requested one keyboard-only alternative on the existing connection, with no further getTab or mouse retry. DOM read succeeded and confirmed Kain active/turn1 and title-button focus. Own server was restarted as session99076 only to support pending assets. Tab→Right→Right attempt then reported CDP Input.dispatchKeyEvent timeout10000ms. No further gameplay action was confirmed; stop condition was met and session99076 was terminated. Viewport was already restored and was not changed again. Final loopback port4404 closure check is included in the result JSON.
