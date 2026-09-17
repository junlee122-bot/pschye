# 9묶음 런타임 읽기 점검

2026-09-15. 저장소는 `<LOCAL_REPOSITORY>`이다. `.env`와 인증 내용은 열지 않았으며 Editor/Hub/브라우저 실행·설치·프로젝트 변경은 이 조사에서 하지 않았다.

## 결론

이번 실제 3인칭 기반은 Unity 본편 프로젝트로 만드는 것이 기존 목표와 일치한다. `docs/RAONJENA_ACTION_ADVENTURE_ROADMAP.md`는 웹 React/Phaser를 이야기·상태·규칙 설계실로 유지하고, 실제 3D 이동·전투는 Unity 6 URP에서 새로 만든다고 명시한다. 웹 Three 기반 게임을 따로 만드는 것은 동일한 이동/카메라/물리/세이브의 두 번째 구현을 만들며 이 방향을 임의 대체하게 된다.

현재 PC에서 Unity Editor/Hub 설치와 활성 라이선스를 확인할 증거가 없다. 따라서 Unity C# 기반과 Editor용 행동 검사를 작성할 수는 있으나 실제 컴파일·임포트·PlayMode 통과를 주장할 수 없다.

## Unity 설치·라이선스 확인

- `<LOCAL_PROGRAM_FILES>/Unity`, `<LOCAL_PROGRAM_FILES>/Unity/Hub/Editor`, `<LOCAL_PROGRAM_FILES>/Unity Hub`, x86의 Unity/Unity Hub, `<LOCAL_USER_HOME>/AppData/Local/Programs/Unity Hub` 모두 존재하지 않는다.
- `<LOCAL_USER_HOME>/AppData/Roaming/UnityHub`, Local/Unity, Roaming/Unity, `C:/ProgramData/Unity`도 없다. Hub의 editors-v2/editors/secondaryInstallPath 목록을 읽을 수 없으므로 별도 설치 경로·실제 Editor 버전도 확인하지 못했다.
- HKLM 및 WOW6432Node, HKCU의 Uninstall 목록에서 Unity Editor/Hub 등록을 찾지 못했다. 문자열 검색의 Git/Visual Studio **Community** 결과는 Unity 설치가 아니므로 제외했다.
- ProgramData/Unity 및 사용자 Local/Unity·Roaming/Unity의 `Unity_lic.ulf`가 없다. 라이선스 내용을 읽거나 로그인·활성화를 시도하지 않았다. 파일 부재만으로 계정의 라이선스 소유 여부를 판정하지 않는다.
- C 루트/기본 Programs의 Unity 경로는 없고 D 드라이브도 없다. 모든 외장·사용자 지정 경로를 전수 검색한 결과는 아니다.

## 기존 Unity 검수 프로젝트

`unity/PsycheCharacterValidation`:

| 항목 | 확인 결과 |
|---|---|
| ProjectVersion | `6000.0.38f1` — 설치 버전이 아니라 프로젝트 목표 버전 |
| URP 선언 | `com.unity.render-pipelines.universal` 17.0.3 |
| 검사 프레임워크 선언 | `com.unity.test-framework` 1.4.5 |
| glTFast 선언 | Unity-Technologies Git URL, ref/commit 고정 없음 |
| 패키지 설치 증거 | `packages-lock.json`, `Library` 없음; manifest 선언을 실제 설치로 보지 않음 |
| 프로젝트 설정 | ProjectSettings에는 ProjectVersion.txt만 있음 |
| 플레이 기반 | 씬·Player/Camera/controller·입력 맵·URP Pipeline Asset 없음 |
| 실제 코드 | `RaonDeformationValidator.cs`는 선택 자산 정적 검수 메뉴, `RaonDeformationStressTest.cs`는 애니메이션/표정 샘플링과 bounds 검사 |
| 캐릭터 | Raon LOD0/1/2 GLB와 sync manifest가 있음 |

README도 Unity Editor 미설치 및 실제 검수 미실행을 명시한다. `artifacts/3d/unity/raon-unity-compatibility-report.md`의 PASS는 Node GLB 정적 검사이다. LOD0 42,592 tris/20 morph/16 animations, LOD1·2 각각 12 animations을 기록하지만 Humanoid Avatar·실제 스키닝·URP 재질·모션 품질 통과는 아니다. 새 본편 프로젝트와 기존 검수 프로젝트를 분리하면 검수 자산·메뉴를 보존할 수 있다.

## 웹의 현재 3D 구현과 패키지

`src/components/ModelReviewLab.tsx`는 `@google/model-viewer`를 동적 import하고 단일 GLB의 orbit 카메라, 확대/팬, 애니메이션 재생, 조명 preset을 제공한다. 직접 조작 캐릭터, 지면·벽 충돌, 중력, 점프, 월드/카메라 충돌은 없다. 기존 Phaser 전장과 수로도 2D다.

| 패키지/로더 | 실제 확인 |
|---|---|
| `@google/model-viewer` | root 의존성 및 실제 설치 4.0.0 |
| `three` | pnpm 간접 peer로 0.169.0 존재. model-viewer 위치에서는 resolve 성공, repo root에서는 MODULE_NOT_FOUND |
| `three/examples/jsm/loaders/GLTFLoader.js` | 간접 Three 패키지 안에 실제 파일 존재. root import는 현재 resolve 실패 |
| `@react-three/fiber`, `@react-three/drei` | root resolve 실패 |
| `@dimforge/rapier3d-compat`, `cannon-es` | root resolve 실패 |

따라서 “Three가 완전히 없다”도, “웹 게임용 직접 의존성이 이미 준비됐다”도 정확하지 않다. 웹 방식이라면 직접 의존성을 선언하고 renderer/씬/애니메이션 상태/물리를 새로 구성해야 하지만, 이번에는 Unity 목표를 유지한다.

## 최소 구현 경로와 경계

1. 신규 `unity/PsycheAdventure`를 Unity 6 URP 본편 기반으로 만들고 기존 검수 프로젝트는 보존한다.
2. 첫 범위는 회색 바닥·벽·계단·경사·낙하 구역과 라온 하나의 CharacterController 이동, 카메라 상대 걷기/달리기·회전·점프·중력·재배치, SphereCast 카메라 충돌이다. 검술·서장 기술·퀘스트 보상을 이 기반과 함께 새로 발명하지 않는다.
3. 모델은 이동 충돌체와 분리된 visual child로 연결하고 GLB 임포트·스킨/애니메이션은 별도로 판정한다. 미검증 GLB에 Collider/물리 품질을 의존하지 않는다.
4. 웹의 이야깃값·ID·성장 규칙을 보존한다. Unity가 TS reducer를 직접 실행하는 연결은 현재 없으므로 처음부터 기존 LocalStorage v10을 덮어쓰거나 동일 저장이라고 주장하지 않는다. 저장 경계는 별도 계약이 필요하다.
5. Editor 설치/패키지 해석/라이선스 준비 후 실제 PlayMode에서 걷기·대각속도·달리기·벽·계단·경사·점프/착지·머리 충돌·낙하 respawn·카메라 벽 압축/복귀를 수행해야 한다. 현재는 작성 가능한 검사와 실제 실행 결과를 구분한다.

`docs/GAME_ENGINE.md`에는 웹 전술전 중심의 “Unity 전환은 3D가 핵심일 때 검토”라는 이전 단계 설명이 남아 있다. 별도의 최신 3D 로드맵과 병행 제품 경계를 명시하면 모순 없이 웹 설계실/Unity 본편으로 해석할 수 있다.

## 조사 방법

`work/ninth-runtime-read.mjs`와 `work/ninth-unity-install-read.mjs`로 알려진 설치 경로, 프로젝트 디렉터리, 허용한 manifest·버전 파일, Node resolve, 설치 레지스트리의 Unity 일치만 읽었다. 프로젝트 소스/문서와 정적 검수 보고서를 읽었으며 수치 생성·검수 실행은 하지 않았다.
