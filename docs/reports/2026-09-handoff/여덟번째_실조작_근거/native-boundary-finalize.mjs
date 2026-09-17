import fs from 'node:fs';
import path from 'node:path';
const work = path.resolve('work');
const names = ['mobile','dialogue','resume','keyboard','slots','reset','storage-failure','corruption','field','focus-field','focus-petal','focus-captain'];
const read = name => JSON.parse(fs.readFileSync(path.join(work, 'native-boundary-' + name + '.json'), 'utf8'));
const records = Object.fromEntries(names.map(name => [name, read(name)]));
const step = (name, label) => records[name].steps.find(step => step.label === label)?.data;
const widths = [];
for (const [name, result] of Object.entries(records)) for (const row of result.steps) {
  const m = row.data?.metrics ?? (row.data?.document && row.data);
  if (m) widths.push({ source: name, label: row.label, viewport: m.viewport, document: m.document, body: m.body, horizontallyOverflowingButtons: m.buttons.filter(b => b.x < -1 || b.x + b.width > m.viewport.width + 1).map(b => b.name) });
}
const returned = step('field', 'return-reload-not-complete').profile;
const complete = step('field', 'complete-confirmation-320').profile;
const result = {
  checkedAt: new Date().toISOString(),
  summary: '격리된 실제 production App에서 저장·슬롯·키보드·320px 경계를 검증했다. 마을 정지 위치 재개, 텍스트 단축키, 슬롯 전환/초기화, 저장 장애/복구, 폐광 확인 전후 재개는 관찰과 저장이 일치했다. 발견한 active 턴 뒤 초점 손실은 세 폼에서 수정했고, 새 빌드에서 폐광 2턴·수련 6동작·카인 4동작과 결과 확인을 키보드만으로 연속 실행해 재확인했다.',
  origin: 'http://127.0.0.1:4409',
  sourceBasis: { initialCommit: 'bbcf10eed6a359fc54d37b16caa9f533b939dcf5', initialProductionEntry: 'index-BVMjwOsu.js', postFixProductionEntry: 'index-DEx4xGQm.js', postFixChunks: ['FieldExamEncounter-BVXdc0Gj', 'PetalTrainingEncounter-BhABoudk', 'CaptainTrialEncounter-BqztIB3K'], postFixSource: 'Initial commit plus root-integrated focus and battlefield changes; final commit pending.', browser: 'headless Microsoft Edge 153.0.4234.32 for resumed checks; early mobile/dialogue files did not record browser.version', runtime: 'User-authorized standalone Playwright; separate browser contexts with IndexedDB-inclusive storageState', artifacts: 'Server serves missing generated asset copies from identical original public assets after disk-space cleanup. Initial boundary observations and post-fix keyboard observations use the distinct entries listed here.' },
  setup: { checkpointSource: 'Root normal UI play; context copies do not count as this agent playing earlier scenes.', files: ['native-village-near-kazrin-storage.json', 'native-capital-before-choice-storage.json', 'native-field-mid-storage.json'], originalUserStorageTouched: false, productSourceOrDistModifiedDuringInitialBrowserRuns: false },
  codeFix: { authorizedByRoot: true, files: ['src/components/FieldExamEncounter.tsx', 'src/components/FieldExamEncounter.test.tsx', 'src/components/PetalTrainingEncounter.tsx', 'src/components/PetalTrainingEncounter.test.tsx', 'src/components/CaptainTrialEncounter.tsx', 'src/components/CaptainTrialEncounter.test.tsx'], behavior: 'An advancing active turn focuses the first enabled radio without selecting it. Initial headings and result section focus remain unchanged.', preFixRegression: { fieldTestsFailed: 2, fieldTestsPassed: 15 }, postFixTargetTests: { files: 3, passed: 36, newDomRegressions: 8 }, targetedEslintPassed: true, whitespaceCheckPassed: true, committedByThisAgent: false, productionBuildByThisAgent: false, rootReportedFullChecks: { tests: 382, files: 28, typecheck: true, fullEslint: true, productionBuild: true }, nativeRecheck: { passed: true, build: 'index-DEx4xGQm.js', fieldTurns: 2, petalActions: 6, captainActions: 4, allThreeResultConfirmations: true, programmaticFocusUsed: false, input: 'Tab / ArrowRight / Space / Enter only after normal UI checkpoint restore', width: 320 } },
  passed: [
    '마을 이동 버튼을 실제 mouse pointer로 누른 채 이동한 뒤 버튼 밖에서 놓자 좌표가 멈췄다. 명시적 synthetic pointercancel 뒤에도 반복 이동이 멈췄다.',
    '실제 touchscreen 입력으로 마을 대화를 열고 ArrowRight를 350ms 눌러도 좌표가 유지됐다. 마지막 한 칸 이동 직후 타이틀→reload→이어하기에서 좌표와 전체 profile이 동일했다.',
    '320px 대화의 내부 스크롤로 세 선택지에 접근했고, 타이틀/마을/폐광 폼·완료/저장 실패·복구 안내의 document/body 폭과 버튼 bounds에서 가로 넘침이 없었다. 실제 캡처도 검토했다.',
    '텍스트 장면에서 실제 수정키/반복 숫자와 버튼 위 숫자는 선택하지 않았다. 제목의 일반 2와 Enter 및 다음 버튼 Enter는 장면을 한 번씩만 진행했고, 다음 장면 제목에 초점이 갔다. 타이틀의 숫자/Enter는 숨은 이야기를 바꾸지 않았다.',
    '실제 슬롯 버튼으로 2→1→2→1→2 전환 후 슬롯별 LocalStorage·IndexedDB profile이 유지됐다. 초기화 취소는 원래 진행을 유지했고, 확인 뒤 같은 슬롯만 초기화되어 reload 후에도 다른 슬롯을 보존했다.',
    'LocalStorage 쓰기만 거부하면 실제 선택이 IndexedDB에 저장됐다. 양쪽 쓰기를 거부한 뒤 실제 다음 장면 입력에서는 실패 안내와 마지막 저장 보존을 확인했고, 쓰기 복원→다시 저장→reload 후 두 저장소가 새 진행과 같았다.',
    '손상된 LocalStorage는 유효 IndexedDB로 복구됐다. 손상 local과 백업 없음에서는 복구 안내/다시 읽기/다른 슬롯 왕복 동안 손상 값을 새 profile로 덮지 않았다.',
    '정상 폐광 1턴 체크포인트에서 실제 Tab/Space/방향키/Enter로 라온 왼쪽·레오 오른쪽 명령을 제출하자 정확히 한 턴만 진행됐다. 선택만으로는 턴이 흐르지 않았다.',
    '폐광 return에서 타이틀→reload→재개는 전체 profile 동일·아직 미완료였다. 실제 모두와 함께 철수 뒤 complete를 다시 reload/재개해도 점수·친밀도·유대가 중복되지 않고 철수 확인 버튼이 다시 나타나지 않았다. 결과 단계는 SECTION으로 초점이 이동했다.',
    '초점 수정 후 새 production 빌드에서 폐광 2턴, 수련의 실제 통찰 선택/시작/6동작, 카인 남은 4동작과 세 결과 확인을 Tab/방향키/Space/Enter만으로 이어갔다. 직접 DOM focus 호출 없이 매 active 턴 첫 enabled radio로 초점이 돌아왔고 선택은 비어 있었다. 결과와 완료 단계의 SECTION focus 및 320px 배치도 확인했다.'
  ],
  findings: [{ id: 'field-active-focus', priority: 'P2', boundary: 'J5', status: 'Fixed in three related components; 36 DOM/SSR tests and native keyboard sequences in all three passed on index-DEx4xGQm.js.', observed: '수정 전 폐광 active→active 명령 제출 뒤 document.activeElement가 BODY로 바뀌었다. 다음 명령을 이어갈 의미 있는 조작부에 초점이 유지되지 않았다.', evidence: 'native-boundary-field.json / keyboard-form-submit-1; fixed behavior in native-boundary-focus-field.json, focus-petal.json, focus-captain.json', cause: 'FieldExamEncounter.tsx executePlan resets orders and disables the focused submit button; the previous focus effect depended only on state.phase.', contrast: 'return/complete transitions focused their SECTION correctly; this behavior remains.' }],
  remaining: [
    '실제 OS touch pointer의 길게 누르기 및 취소. 실제 hold/release는 mouse pointer였으며 취소는 synthetic event다.',
    '모바일 액션 동료 명령 버튼의 이번 브라우저 실행. 정상 action 체크포인트가 아직 전달되지 않았다.',
    '실제 IME/편집 영역에서의 숫자 단축키. 해당 내용은 기존 DOM 회귀 근거이며 이번 실제 제품 UI 검증으로 세지 않는다.',
    '자연적으로 늦게 도착한 이전 슬롯 콜백 자체의 관찰. 이번 슬롯 전환은 실제 UI이며 강제 콜백 주입은 하지 않았다.'
  ],
  limitations: [
    '정상 UI 체크포인트를 별도 context에 복제했다. 이 결과는 새 게임부터 전체 여정을 이 agent가 연속 완주했다는 뜻이 아니다.',
    '저장 장애는 격리 context에서 Storage.prototype.setItem과 IDBObjectStore.prototype.put에 QuotaExceededError를 주입한 뒤 복원했다. 손상 사례는 테스트 local JSON과 IDB 백업만 바꿨다. 실제 디스크 고갈과 구분한다.',
    '초기 locator.tap은 애니메이션 버튼의 안정성 대기로 종료됐다. 관찰한 bounds의 실제 touchscreen.tap 및 키보드 Enter로 대화를 열었다. 브라우저 연결 실패로 보지 않는다.',
    '초기 dialogue evidence의 이동 버튼 좌표 터치는 대화 overlay의 선택지에 닿았다. 이때 좌표가 유지됐지만 가려진 이동 버튼의 handler를 직접 실행했다고 주장하지 않는다. 키보드 이동 차단은 실제로 확인했다.',
    '테스트 스크립트의 .title-primary 선택자 및 초기화 후 canvas 기대를 수정했다. 후속 .title-actions .primary-action/타이틀 복귀 재확인 결과를 사용하며 원래 실패 evidence도 보존했다.',
    '중간 서버 종료는 root host ENOSPC로 발생했다. 디스크 정리 후 재개했으며 이 환경 중단을 제품 실패로 세지 않는다.',
    '초기 폐광 실행에서는 두 번째 제출의 라온 radio 초점을 locator.focus로 준비했다. 수정 후 별도 focus-field 재검증은 두 턴과 철수 확인을 실제 키보드만으로 이어갔다. 두 실행 근거를 구분한다.',
    '각 실행 동안 수집한 console warning/error, pageerror, requestfailed 배열은 비어 있었다. 전체 제품에 오류가 없다는 보장은 아니다.'
  ],
  fieldBoundary: { returnPhase: returned.originStory.fieldExam, completePhase: complete.originStory.fieldExam, selectionScore: { before: returned.originStory.selectionScore, after: complete.originStory.selectionScore }, leoAffinity: { before: returned.world.npcMemories.leo.affinity, after: complete.world.npcMemories.leo.affinity }, bondsEqual: JSON.stringify(returned.bondLevels) === JSON.stringify(complete.bondLevels), newFlags: complete.originStory.flags.filter(f => !returned.originStory.flags.includes(f)) },
  widths,
  screenshots: Object.values(records).flatMap(r => r.screenshots),
  evidence: names.map(name => path.join(work, 'native-boundary-' + name + '.json')),
  logs: Object.fromEntries(Object.entries(records).map(([name, r]) => [name, { warningsAndErrors: r.logs, requestFailures: r.requests }])),
  cleanup: { allOwnBrowsersAndContextsClosed: Object.values(records).every(r => r.steps.at(-1).label === 'cleanup'), ownServerCreated: false, rootServerStopped: false, tracing: false, video: false, diskCacheLimitBytesForResumedChecks: 1048576 }
};
fs.writeFileSync(path.join(work, 'native-boundary-result.json'), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(work, 'native-boundary-notes.md'), `# 별도 브라우저 경계 검증\n\n${result.summary}\n\n- 초기 기준: ${result.sourceBasis.initialCommit} / ${result.sourceBasis.initialProductionEntry}\n- 초점 수정 후 실제 재검증 빌드: ${result.sourceBasis.postFixProductionEntry}\n- origin: ${result.origin}; 정상 UI storageState 복제, 원래 사용자 저장 접근 없음\n- 재개 후 브라우저: Edge 153.0.4234.32, headless, tracing/video 없음\n\n## 실제 확인\n\n${result.passed.map(v => '- ' + v).join('\n')}\n\n## 수정한 발견과 검증\n\n세 폼 컴포넌트와 각각의 기존 테스트, 총 6파일을 수정했다. active 턴 증가 시 첫 사용 가능한 radio에 초점을 돌리고 선택은 자동 실행하지 않는다. 초기 제목 및 결과 SECTION 초점은 유지했다. 수정 전 폐광 회귀 2개 실패를 확인한 뒤 수정했고, 관련 3파일 36개 검사(신규 DOM 8개)와 표적 ESLint가 통과했다. 루트의 전체 382개/타입/전체 ESLint/빌드도 통과했다. 새 빌드의 실제 키보드 재검증은 세 폼 모두 통과했다.\n\n${result.findings.map(v => '- ' + v.observed + ' 근거: ' + v.evidence).join('\n')}\n\n## 남은 범위\n\n${result.remaining.map(v => '- ' + v).join('\n')}\n\n## 실입력과 준비·장애 주입의 구분\n\n${result.limitations.map(v => '- ' + v).join('\n')}\n\n## 정리\n\n자체 브라우저와 context는 모두 닫았다. 루트 4409 서버는 종료하지 않았다. 자세한 전후 값·폭·스크린샷 경로는 native-boundary-result.json과 각 원본 evidence JSON에 보존했다.\n`);
console.log(JSON.stringify({ result: path.join(work, 'native-boundary-result.json'), evidenceCount: names.length, widthsChecked: widths.length, screenshots: result.screenshots.length, cleanup: result.cleanup }));
