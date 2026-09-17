# 라온제나 — 다른 로컬에서 이어받기

작성일: 2026-09-15. 마지막 게임 소스 작업은 `2981276`(9묶음 Unity 3인칭 기반)이다. 이 문서와 AAA 제작 조사는 그 이후 문서 커밋으로 함께 전달된다. 새 작업은 최신 `main`에서 시작한다.

## 1. 현재 상태

- **웹:** 8묶음의 382개 테스트와 핵심 실브라우저 여정 검증 기록이 있다. 자세한 통과·미검증 범위는 [전체 여정 검증](https://github.com/junlee122-bot/raonjena/blob/main/docs/FULL_JOURNEY_VERIFICATION.md)에 있다.
- **Unity:** `unity/PsycheAdventure`에 이동·점프·충돌·3인칭 카메라·연습장·라온 모델 로더와 테스트 34개를 작성했다. **패키지 해결·Unity 컴파일·테스트 실행·실플레이·Windows 빌드는 아직 미실행이다.**
- **모델:** Unity용 PNG 텍스처 파생 GLB가 Git에 포함돼 있으므로 첫 실행을 위해 AI 생성이나 변환을 다시 할 필요가 없다. 원본 v2도 보존돼 있다. 최종 스키닝·재질 품질 승인은 남아 있다.
- **문서:** [3인칭 기반](https://github.com/junlee122-bot/raonjena/blob/main/docs/THIRD_PERSON_FOUNDATION.md), [Unity 시작 안내](https://github.com/junlee122-bot/raonjena/blob/main/unity/PsycheAdventure/README.md), [젤다·붉은사막 수준 제작 조사](https://github.com/junlee122-bot/raonjena/blob/main/docs/AAA_PRODUCTION_RESEARCH.md)를 먼저 읽는다.

## 2. 저장소 받기

새 폴더에서 권한 있는 계정으로 복제한다.

```powershell
git clone https://github.com/junlee122-bot/raonjena.git
Set-Location pschye
git log -1 --oneline
git status --short
```

기존 클론을 쓴다면 자기 변경을 먼저 보존하고 정상적인 fast-forward 갱신을 사용한다. 다른 로컬 변경을 덮어쓰는 강제 reset·force push는 필요 없다.

`Library`, `Temp`, 로컬 빌드·테스트 로그, `node_modules`, 로컬 Blender/AI 런타임, 비밀 환경변수는 저장소 복제로 전달되지 않는다. 기본 Unity 연습장 실행은 유료 AI API 키를 요구하지 않는다. 과거 외부 `outputs`의 모든 스크린샷·긴 대화가 복제되는 것은 아니지만 현재 시작 절차와 판정 경계는 이 저장소 안에 있다.

## 3. 첫 작업은 9묶음의 실제 엔진 검증

1. **Unity 6000.0.75f1**을 준비한다. 기본 위치가 아니면 실제 `Unity.exe` 경로를 지정한다. 프로젝트를 다른 Editor로 자동 업그레이드하지 않는다.
2. 저장소 루트에서 다음 명령을 순서대로 실행한다.

```powershell
.\tools\unity\Invoke-Adventure.ps1 -Action Probe
.\tools\unity\Invoke-Adventure.ps1 -Action Verify
.\tools\unity\Invoke-Adventure.ps1 -Action EditMode
.\tools\unity\Invoke-Adventure.ps1 -Action PlayMode
.\tools\unity\Invoke-Adventure.ps1 -Action Open
.\tools\unity\Invoke-Adventure.ps1 -Action Build
```

각 명령에 `-UnityEditorPath '실제 Unity.exe 경로'`를 붙이거나 `UNITY_EDITOR_PATH`를 설정할 수 있다. 기본 Probe는 읽기만 한다. 나머지 검증 액션은 숨김 batchmode이고 Open만 Editor 창을 연다. Editor로 프로젝트를 열어 둔 동안 동일 프로젝트의 batchmode를 동시에 실행하지 않는다. 실조작 후 Editor를 닫고 Build를 실행한다.

3. 최초 패키지 해결·컴파일 오류를 실제 로그로 고친다. manifest의 URP 17.0.3·glTFast 6.20.0·Test Framework 1.4.5는 선언이며 해결 완료 증거가 아니다.
4. Editor에서 **Raonjena → Adventure → Prepare Project → Open Foundation Scene**을 사용하고 Play한다. 준비 메뉴가 자동 초기화에서 건너뛰어졌다면 패키지 가져오기 후 다시 실행한다.
5. 걷기·달리기·대각선·계단·경사·벽·천장·점프·낙하·카메라·포커스/일시정지와 모델 로드 실패/재시도를 확인한다. 라온의 발·어깨·무릎·얼굴·머리카락을 게임 카메라에서 검수한다.
6. Windows 실행 파일에서 모델과 셰이더·한글 HUD·입력이 실제로 표시되는지 검사한다. `Verify` 성공은 수동 플레이 승인과 다르다.

로그·XML은 `unity/PsycheAdventure/TestResults`의 실행별 폴더, 성공한 Windows 빌드는 `Builds/RaonFoundation/RaonFoundation.exe`에 생성된다. 현재 Git에는 완료된 플레이어 빌드가 없다. XML의 실제 실행 수·실패·스킵을 확인한다. 작성한 사례 수를 통과 수로 보고하지 않는다.

## 4. 첫 성공 뒤 남길 증거와 커밋

- Editor·실제 패키지 버전, OS·GPU·메모리, 소스 커밋, 테스트 결과·실플레이 확인 항목.
- 생성된 `Packages/packages-lock.json`, 필요한 ProjectSettings·URP 설정과 meta를 검토해 커밋.
- 컴파일/테스트/스키닝/물리에서 발견한 오류와 수정 근거. 미검증은 별도 표시.
- 로그·빌드 캐시는 `.gitignore`대로 제외하고, 추린 검증 요약과 재현 정보는 `docs` 또는 `artifacts`에 저장. API 키와 로컬 인증 파일은 포함하지 않는다.

실제 측정 전에 `world:readiness`의 파일 존재 점수나 캐릭터 fidelity 점수로 Unity 완료를 선언하지 않는다. 기존 `PsycheCharacterValidation`은 별도 검수 프로젝트이며 이번 본편 프로젝트와 혼동하지 않는다.

## 5. G0 통과 이후의 첫 제작 순서

1. 라온 한 무기·한 적의 전투: 공격 예고, 회피/흘리기, 반격, 피격·사망·재시도.
2. 기존 로드맵의 공용 환경 행동 하나: 탐험·퍼즐·전투에 일관된 반응.
3. 월드 상태·퀘스트·선택·저장·보상 한 번 확정의 계약.
4. 마을→길→폐허→귀환의 작은 완주 구간, 이후 30~40분 대표 구간으로 확대.
5. 캐릭터·아트·음향·성능 통합과 외부 플레이테스트. 두 번째 구역 제작 시간으로 인력·범위 재산정.

현재 웹 LocalStorage를 Unity가 직접 공유하거나 이전하는 구현은 없다. 웹의 정사·규칙·테스트 사례를 참고하되 새로운 저장 포맷과 마이그레이션은 별도 검증한다. 엔진 변경·대륙 규모 확대·다수 캐릭터 양산은 대표 장면과 생산성 근거를 갖춘 뒤 결정한다.
