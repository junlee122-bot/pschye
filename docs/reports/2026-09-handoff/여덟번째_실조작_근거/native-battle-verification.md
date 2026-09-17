# 정식 첫 전투 실제 브라우저 검증

2026-09-15 · Edge 153.0.4234.32 · 독립 Playwright context · http://127.0.0.1:4409

실제 서장 전체를 플레이하여 얻은 `native-first-mode-select-storage.json` / `native-first-mission-prepared-storage.json`의 복제본으로 시작했다. 각 복제본은 별도 브라우저 저장소다. 전투 결과·수치·phase를 만들어 넣거나 게임 함수를 직접 호출하지 않았다. DOM 버튼, 키보드, 실제 Canvas 포인터만 입력했고 LocalStorage는 관측했다.

## 원본 production bbcf10e

- 6인·정규·대응 사격·통찰: 크리스 추천 명령으로 숨은 저격수 발견 → 라온을 숫자키로 선택 → 16꽃잎을 선택하고 Canvas의 실제 저격수 클릭. 목격 발생을 확인했다.
- 명령 2개 후 저장하고 나가기 → 새로고침 → 재개에서 battle와 tactical history/선택을 저장 직후 값과 deepEqual 비교했다. 행동 취소는 첫 명령 직후 전투 상태와 일치했다.
- 취소한 공격을 실제 Canvas로 다시 수행하고 추천 명령/연대기/적 행동 실행을 조작하여 2라운드 승리, 목표 HP 118을 달성했다.
- 첫 승리 보급 +90, 정보 +30, 유물 +1, 명성 +45, 날짜 +3, 출전 영웅 6명 각각 XP +70. 목격 토큰 확인. 결과 재접속·다시 보기·지도 복귀에서 보상과 기록이 중복되지 않았다.
- 액션은 390×844 viewport에서 실제 이동 키, 크리스 명령, 패링·회피 버튼을 사용했다. 동료 버튼 5개는 x=200, width=180, y=252/297/342/387/432, height=40으로 모두 화면 안이었다. scrollWidth=innerWidth=390. 크리스 실제 클릭 후 9.0초 쿨다운을 확인했다.
- 일시정지 동안 시간이 흐르지 않았다. 저장하고 나가기·새로고침·재개 안내에서 위치와 남은 타이머 등 action checkpoint가 정확히 보존되었다.
- 재개 후 전투 입력 없이 실제 적 공격을 기다려 시뮬레이션 18.144초에 라온 HP 0, 목표 HP 30의 패배를 확인했다. XP/자원/완료/기록 보상 없음. 패배 재접속 후 다시 도전은 새 attempt ID와 출전 당시 능력치를 유지했다.
- 액션→전술 전환 확인을 취소하면 ID 유지, 승인하면 새 ID·초기 전술 상태·동일 출전 능력치, action checkpoint 제거를 확인했다.

## 발견하여 수정한 제품 문제

`src/components/PhaserBattlefield.tsx`만 수정했다.

1. 적의 보이는 중앙 클릭은 반응하지 않고 원 안의 좌상단 20 logical px 위치에서만 공격했다. Shape 로컬 입력 좌표에 display origin이 더해지는 데 hitArea 중심이 (0,0)이었다. 조장/적 원형 hitArea 중심을 각 Shape.displayOriginX/Y에 맞췄다. 반지름·피해·전투 규칙은 바꾸지 않았다.
2. 표적 공격 연출마다 `this.ease is not a function` pageerror(원본 실행 2회)가 발생했다. 카메라 Zoom은 Tween 별칭 `Cubic.Out/In`을 받지 않으므로 실제 Phaser easing 함수를 전달했다. 줌 복귀도 진행 중인 effect의 callback에서 무시되지 않도록 ZOOM_COMPLETE 시점으로 옮겼다.

원본 브라우저 오류 수집은 message만 보관했다. 별도 `native-battle-zoom-contract.json`의 stack은 설치된 Phaser Zoom 클래스에 동일 인자를 준 진단 결과이며 브라우저 stack으로 주장하지 않는다. 같은 진단에서 수정 방식은 오류 없이 줌 1로 복귀했다.

## 재빌드 후 검증

새 production `index-DEx4xGQm.js` / `PhaserBattlefield-D-4MYew8.js`에서 4인 편성을 실제 UI로 구성했다. 입단·첫 선택 세이브에서 카인과 레오를 동행 해제하고 출전했으며 프로필을 직접 수정하지 않았다.

- 원본 6인 출전과 전체 heroProgress 및 공통 영웅의 출전 정의가 deepEqual이었다. 편성만 달라지고 성장·장비·난이도를 바꾸지 않았다.
- 숫자키로 크리스를 선택한 뒤 Canvas 라온의 중앙을 눌러 실제 선택을 바꾸었다. 적 중앙 클릭도 오프셋 0으로 16꽃잎·목격을 발동했다. 중앙이 빗나가면 실패하는 회귀 assertion을 사용했다.
- 중간 저장·재접속에서 battle/tactical history/선택이 정확히 유지됐고 행동 취소/중앙 재공격이 정상 동작했다.
- 라온·하도리·카즈린·크리스 4인이 2라운드, 목표 HP 118로 승리했다. 4명에게만 XP +70이 지급됐고 미출전 카인·레오 heroProgress는 완전히 유지됐다. 자원 첫 보상·목격도 확인했다.
- 결과 재접속 후 지도 복귀에서는 보상/기록이 유지되었다. 다시 실제 출전 버튼으로 새 attempt ID를 만들고 2라운드에 재현 승리했다. 날짜·자원·모든 heroProgress·완료 임무·기록에 추가 보상이 없었다.
- 이 실행 전체의 pageerror/console error는 0이었다. 수정된 중앙 클릭과 카메라 연출을 실제 production에서 다시 확인했다.

## 증거와 실행

- `node work/native-battle-tactical.mjs` → `native-battle-tactical-results.json`, 6인 시작/중간/승리 profile·스크린샷. 전투·저장·보상 검사는 통과했지만 위 입력/연출 결함을 함께 기록했다.
- `node work/native-battle-action.mjs` → `native-battle-action-results.json` (passed, errors=[]), 모바일 동료/중간/패배 profile·스크린샷.
- `node work/native-battle-tactical.mjs --four --fixed` → `native-battle-four-tactical-results.json` (passed, errors=[]), 4인 시작/중간/첫 승리/재현 승리 profile·스크린샷.
- `node work/native-battle-zoom-contract.cjs` → `native-battle-zoom-contract.json` (별도 라이브러리 진단).

모바일 크기는 브라우저 viewport 검증이며 실제 휴대폰 OS의 터치 취소·장치 성능 검증은 아니다. 액션 승리는 아직 이 검증의 대상이 아니며, 실제 액션 패배와 전술 승리를 각각 구분했다. 전투 외 새 서장 전 과정은 부모 작업의 별도 실제 플레이 증거를 사용한다.
