# 9묶음 — 라온의 3인칭 조작 기반

2026-09-15. [액션 어드벤처 로드맵](RAONJENA_ACTION_ADVENTURE_ROADMAP.md)의 Unity 6 URP 방향에 따라 `unity/PsycheAdventure`를 추가했다. **구현 소스와 에셋은 준비됐고, Unity에서의 완료 판정은 대기 중이다.** 현재 PC의 알려진 설치 경로와 설치 기록에서 Unity Editor를 찾지 못했다. 다른 위치의 설치까지 부재라고 단정하지 않는다.

## 구현 범위

| 부분 | 구현 내용 |
|---|---|
| 라온 이동 | 카메라 상대 이동, 걷기 2.6m/s·달리기 5.4m/s, 가속·감속·회전, 점프 높이 기준 1.2m, 중력·천장·접지·낙하 복귀 |
| 충돌 | CharacterController 높이 1.8m·반경 0.3m·턱 0.3m·경사 45도, 플레이어 층과 카메라 검사 분리 |
| 카메라 | 3인칭 회전·줌, 거리·상하각 제한, SphereCast 충돌과 초기 겹침 처리, 벽에서 당기기·열린 공간에서 복귀 |
| 연습장 | 평지·벽·낮은 계단·경사·급경사·점프 발판·낙하 구역, 재배치·진단 HUD |
| 시각 모델 | 비동기 GLB 로드, 필수 메시·관절·텍스처·재질·클립 확인, 취소·재로드·파괴 정리, idle/walk/run/jump 전환 |
| 프로젝트 | 고정 패키지 선언, 영속 장면·meta GUID, URP 준비 메뉴, Verify·테스트·Windows 빌드 호출 |

CharacterController.Move는 자체 중력을 적용하지 않으므로 수직 속도를 별도로 적분한다. 시작점이 충돌체 안에 있는 경우를 SphereCast 하나에 맡기지 않고 겹침 검사로 처리한다. [Unity Move API](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/CharacterController.Move.html), [SphereCast API](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Physics.SphereCast.html).

장면에는 bootstrap을 저장하고 지형·라온·카메라는 Play 때 구성한다. 회색 연습장을 정식 첫 마을·던전 제작 완료로 세지 않는다. 웹의 정사·전투 수치·저장 파일과 기존 Unity 캐릭터 검수 프로젝트는 이번 묶음에서 수정하지 않았다.

## 모델 호환성 해결

원본 v2는 `EXT_texture_webp`가 필수였으므로 현재 선택한 glTFast용 파생본은 내장 이미지 22개를 PNG로 바꿨다. RGBA 디코딩 결과와 비이미지 bufferView가 원본과 일치하는지 변환 도구에서 검사했다. 원본 5,427,548바이트에서 파생본 20,174,828바이트로 커졌다. 이는 호환용 원본 크기이며 실제 GPU 메모리·최종 배포 최적화 수치가 아니다.

- 42,592 삼각형, 33 관절, 표정 모프 20개, 클립 16개 보존.
- Y-up·높이 약 1.779m, 바닥 보정 약 -0.000511m. 실제 애니메이션 발 접지는 미검증.
- 재질은 8개, 그중 머리카락은 양면 BLEND. 런타임 로드용 URP Lit 및 glTF metallic/roughness 셰이더를 보존하도록 설정.
- 로더의 구조 검사는 수동 리토폴로지·스키닝·얼굴·머리카락 품질의 승인 기준을 대체하지 않는다.

변환 도구와 상세 근거는 `tools/3d/prepare-raon-unity-runtime.mjs`, `artifacts/3d/unity/raon-unity-runtime-conversion.json`이다. glTFast의 기능·런타임 로드·빌드 셰이더 처리 기준은 [공식 glTFast 6.20 문서](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.20/manual/index.html)를 따른다.

## 검증 상태와 다음 관문

| 검사 | 상태 |
|---|---|
| GLB 변환·픽셀·비이미지 데이터 보존 | 실행 통과 |
| 변환 도구 Node 구문·ESLint | 실행 통과 |
| 공유 C# API·glTFast 6.20 소스 검토 | 수행, 확정 오류 발견 없음 |
| Unity Editor 설치 탐지 | 알려진 경로에서 미발견 |
| 선언된 Unity/URP/glTFast 패키지 해결 | 미실행 |
| Unity C# 컴파일·장면 열기 | 미실행 |
| EditMode 21개 / PlayMode 13개 | 작성, 미실행 |
| 실제 모델 변형·물리·입력·셰이더 검증 | 미실행 |
| Windows 빌드·프레임/메모리 검증 | 미실행 |

정적 검사 통과나 파일 존재 점수를 Unity 플레이 성공으로 취급하지 않는다. 기존 웹 테스트 결과 역시 이 프로젝트의 컴파일·물리 검증 증거가 아니다.

다음 순서는 **Editor 경로 확인 → Verify → EditMode → PlayMode → 실제 조작·시각 검수 → Windows 빌드 확인**이다. 실행 방법은 [프로젝트 시작 안내](../unity/PsycheAdventure/README.md)에 있다. 기준 Editor는 [6000.0.75f1](https://unity.com/releases/editor/whats-new/6000.0.75f1)이고, 버전 선언은 설치·해결 완료를 의미하지 않는다.

이 관문을 통과한 뒤 다음 묶음의 첫 3D 여정으로 진행한다. 마을·길·폐허·귀환 연결, 상호작용, 검술, 월드 상태·체크포인트·선택 기록의 계약이 후속 범위다. 기존 웹 LocalStorage를 Unity에서 공유하거나 변환하는 코드는 아직 없다.
