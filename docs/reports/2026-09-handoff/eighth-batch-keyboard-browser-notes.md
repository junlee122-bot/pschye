# Eighth-batch final keyboard fix — bounded browser check

- Production basis from root: index-BVMjwOsu.js / VillageAdventure-CzTBt3ge.js. Base commit before root final commit is1d07e4f plus eighth-batch fixes.
- Isolated4408 slot1, ignored tmp/eighth-keyboard-review, separate fixture build output. Real App/styles/current source and actual choose/save/load APIs; original src/dist and user storage untouched.
- Explicit setup: earlier5 scene completed IDs are prep, fresh currentSceneId capital-gate, then actual chooseOriginStoryPath('identify-poison'). No earlier actual play or invented result. Page exposes beforeMount and actual reloaded summary in read-only JSON.
- Target actual interaction: title button locator.press Enter from selected capital-gate → title screen; inspect actual save after navigation. currentSceneId/score/choices/completedSceneIds must remain identical. Capture320px heading/button/record where possible.
- No repeat of diagnostics or village path. One bounded fresh-connection recovery at most. If input/connection failure recurs, preserve only observed scope and clean up.

## Completed functional observation (2026-09-15T01:42:24.004Z)

- Separate fixture built in44.95s after root final-build signal. Fixture index-x3WK5GYv.js; primaryCSS index-CUmxpurm.css. Current production main index-BVMjwOsu.js. Original src/dist preserved; fixture files git-ignored.
- Fresh Edge tab1908172966/origin4408/slot1. Generated earlier5completedIDs as explicit setup, realcapital-gate identify-poison choice producedscore4, actual save/load fullsummary identical.
- Actual Enter on the visible title button reportedInput.dispatchKeyEvent timeout1312ms. OnegetTab recovery succeeded and observedtitle URL (no sectionquery), chapter6/capital-gate slot. No repeatedEnter.
- Actual post-navigationload via the fixturebutton confirmedcurrentSceneId=capital-gate,score4,choicesandcompletedSceneIdsunchanged; entireexpandedsummarysameasbeforeEnter. This verifies the functional regression despite inputAPI timeout.
-320pxviewport applied; AX displayed titlebuttonsandsave slots. Fullpagescreenshot then failedPage.captureScreenshot timeout5000ms. Boundedscope ended immediately: no secondcapture or reconnect. Screenshotfile was notcreated; subsequentDOMwidth/logquerieswere notexecuted. No visualoverflow/noerrorspassclaim.
- Cleanup: viewportreset succeeded, server82508stoppedCtrl-C/exit1, port4408closed=true. No useroriginalsave/src/distaccessorchange.
- This is a preparedone-scene keyboardregression, separatefromtheunfinishedJ1manualjourneyandroot'sDOMintegrationjourney.
