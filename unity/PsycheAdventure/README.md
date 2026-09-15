# 라온 · 첫걸음 — Unity 3인칭 기반

라온 한 명의 이동과 카메라를 검증할 독립 Unity 프로젝트입니다. 벽·계단·경사·점프 발판이 있는 연습장을 Play 때 구성합니다. 기존 웹 게임과 `PsycheCharacterValidation`은 별도로 유지합니다.

**2026-09-15 상태: 소스·장면·에셋 준비. Unity Editor 미확인으로 패키지 해결, C# 컴파일, 실제 플레이와 Windows 빌드는 미검증입니다.** 플레이 가능한 빌드가 완성됐다는 뜻은 아닙니다.

## 시작

1. Unity Hub에서 이 폴더(`unity/PsycheAdventure`)를 프로젝트로 엽니다. 프로젝트 기준 버전은 **6000.0.75f1**입니다.
2. 패키지 가져오기와 컴파일이 끝날 때까지 기다립니다. manifest에는 URP **17.0.3**, glTFast **6.20.0**, Test Framework **1.4.5**가 고정돼 있습니다. 현재 저장소에는 패키지 해결 결과인 `packages-lock.json`이 없습니다.
3. 메뉴 **Raonjena → Adventure → Prepare Project**로 URP 렌더 설정과 런타임 셰이더 보존을 준비합니다. 최초 Editor 로드에서도 준비를 시도합니다. 패키지 가져오기 중 건너뛴 경우 이 메뉴를 다시 실행합니다.
4. **Raonjena → Adventure → Open Foundation Scene**을 선택하고 Play를 누릅니다. 로드 중에는 조작이 잠기며 실패 원인과 재시도 버튼이 표시됩니다.
5. 오류가 있으면 Console과 `TestResults` 로그를 보존해 원인을 고칩니다. 아래 검증을 마치기 전에는 다음 3D 여정의 완료 근거로 사용하지 않습니다.

준비 메뉴는 이 프로젝트의 URP 설정·1280×720 창·선형 색 공간·Direct3D 11·빌드 장면을 설정합니다. 생성된 `Assets/Adventure/Settings`와 ProjectSettings 변경, 실제로 해결된 `Packages/packages-lock.json`은 최초 Editor 검증 뒤 검토하여 커밋합니다. `Library`·로그·빌드 결과는 제외됩니다.

## 조작

| 입력 | 동작 |
|---|---|
| WASD / 방향키 | 카메라 방향 기준 이동 |
| Shift | 달리기 |
| Space | 지상에서 점프 |
| 마우스 오른쪽 버튼 드래그 | 카메라 회전 |
| 휠 | 카메라 거리 조절 |
| C | 카메라 초기화 |
| R | 시작 위치로 복귀 |
| Esc | 일시정지·재개 |
| F3 | 속도·접지·모델 상태 진단 |

다른 창으로 전환하면 일시정지합니다. 입력은 기본 키보드·마우스 기반이며 패드·키 재지정은 후속 범위입니다.

## 명령으로 검증하기

저장소 루트의 PowerShell에서 실행합니다. 별도 위치의 Editor는 `-UnityEditorPath 'D:\Unity\Editor\Unity.exe'` 또는 `UNITY_EDITOR_PATH`로 지정합니다. 기본 Probe는 읽기만 하며, Editor가 없으면 다른 액션은 명확한 오류로 종료합니다.

```powershell
.\tools\unity\Invoke-Adventure.ps1 -Action Probe
.\tools\unity\Invoke-Adventure.ps1 -Action Verify
.\tools\unity\Invoke-Adventure.ps1 -Action EditMode
.\tools\unity\Invoke-Adventure.ps1 -Action PlayMode
.\tools\unity\Invoke-Adventure.ps1 -Action Open
.\tools\unity\Invoke-Adventure.ps1 -Action Build
```

`Verify`는 프로젝트 준비·컴파일·장면 열기를, 테스트 액션은 NUnit XML의 실제 결과를 확인합니다. 물리 PlayMode 검사에는 벽·턱·경사·점프·천장·낙하·카메라 충돌과 복귀가 포함됩니다. 지금 작성된 사례는 **EditMode 21개, PlayMode 13개**이며 **실행 통과 수는 아직 없습니다**. `Build` 성공 시 `Builds/RaonFoundation/RaonFoundation.exe`가 생성됩니다. 자동 검증 성공 뒤에도 모델·조작·재질은 아래 실기로 확인해야 합니다.

## 실제 플레이에서 확인할 것

- 대각선 이동 속도, 걷기/달리기 전환, 벽 밀기, 낮은 계단, 완만한 경사와 급경사 차단.
- 점프·착지, 공중 재점프 차단, 천장 충돌, 바닥 밖 낙하 후 복귀.
- 벽과 모서리에서 카메라 충돌·복귀, 거리/상하각 제한, 재배치 직후 카메라.
- 라온 정면·스케일·발 위치, 걷기/달리기/점프 관절 변형, 피부·눈·양면 투명 머리카락의 재질.
- 로드 실패·재시도·일시정지·포커스 전환·연속 재로드·장면 종료에 오류나 잔존 모델이 없는지.
- Windows 빌드에서 모델과 재질이 실제 표시되는지, 한글·버튼·조작이 정상인지.

## 라온 에셋

`Assets/StreamingAssets/Raon/raon-unity-runtime.glb`는 기존 `public/models/characters/raon/raon-production-v2.glb`의 **WebP 텍스처만 PNG로 변환한 파생본**입니다. 원본의 기하·리그·애니메이션은 그대로 유지했습니다. 기존 후보의 수동 리토폴로지나 최종 스키닝 품질을 새로 완성한 것은 아닙니다.

변환 결과는 `artifacts/3d/unity/raon-unity-runtime-conversion.json`에 있습니다. 재생성은 저장소 루트에서 다음 명령을 사용합니다. `sharp`는 현재 웹 필수 의존성이 아니므로 설치된 모듈 경로를 명시할 수 있습니다.

```powershell
node tools/3d/prepare-raon-unity-runtime.mjs --sharp-module 'C:\path\to\node_modules\sharp'
```

기존 Legacy 클립 `idle`·`walk`·`run`·`jump`를 연결했습니다. 별도 낙하 애니메이션, 발 IK, 최종 Humanoid 리타게팅, 검술과 퀘스트·세이브는 후속 작업입니다. 물리 이동과 시각 모델 루트를 분리했으며 지형 충돌은 CharacterController가 처리합니다.

설계와 판정 근거: [3인칭 기반 문서](../../docs/THIRD_PERSON_FOUNDATION.md).
