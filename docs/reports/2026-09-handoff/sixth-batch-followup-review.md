# Sixth batch: uncompleted manual-route follow-up

Checked 2026-09-15 00:19:45 UTC. Requested HEAD `d059ed53fa5d4d53d4be687195ba65cc2288df95` confirmed before the run.

## Isolated setup

- New4400 origin for field-exam and4401 for the optional village return. Existing user origins/storage were not used.
- No production rebuild and no source/original dist changes. Copied only the existing fixture HTML/entry into ignored `tmp/sixth-batch-followup`, changed fixture guard/labels to the new port, and reused other hashed assets read-only.
- Field entry basis is the fifth-batch build `index-CRxl8JzP.js`, whose game source corresponds to d059ed5. The optional village copy is the older third-batch `index-Wxcxb7NC.js`; it was not opened and does not establish current-HEAD village behavior.
- Copy hashes and exact roots are recorded in `work/sixth-batch-followup-fixture-basis.json`. Both files are ignored by git.

## Actual observation and failure boundary

- Created fresh own Edge tab1908172956 at4400. App title and the test fixture menu rendered.
- Clicked only the choice-before scene seed. The last successful AX response showed `4400 격리 실습 기록 준비 중…`.
- The next getAXState failed with `Debugger unattached`. One getTab recovery for the same tab also failed with `Debugger unattached`.
- Stopped at the agreed recovery limit. No actual rescue-team or defy-order choice was made, and no manual route was completed. No4401 village tab was attempted after transport failure.
- This is an automation transport limitation, not evidence of an application gameplay failure. Seed save completion after the last observed state is unknown. No screenshots or browser logs were recovered.

## Remaining and cleanup

- Both additional field-exam routes and the village Kazrin return-confirmation/next-scene flow remain unchecked. Earlier split-route manual completion and core-test coverage are separate evidence.
- No viewport override was applied in this run.
- Server15579 (both4400 and4401) stopped with Ctrl+C, exit1. No follow-up server remains from this agent.
- Structured report: `work/sixth-batch-followup-result.json`.
