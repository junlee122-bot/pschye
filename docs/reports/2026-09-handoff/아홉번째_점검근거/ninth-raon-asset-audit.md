# 라온 3D 자산 감사 — 9번째 묶음

검사 시각: 2026-09-15T06:15:24.191Z. 기준 HEAD: 3f7922abbeabc0ef936ee56f268bc7d394db58db.

현재 실조작에는 **production-v2에서 PNG만 무손실 변환한 raon-unity-runtime.glb**를 권장한다. 기존 자동 제작 후보를 연결하는 단계이며 최종 모델이나 실제 Unity 검수 완료로 표시하지 않는다. 원본 production-v2는 보존했다.

## 직접 확인한 파일

| 파일 | MiB | 삼각형 | skin/joints | 클립/모프 |
| --- | ---: | ---: | --- | --- |
| raon-blender-rigged-lod1-v1.glb | 7.32 | 39,909 | 1/33 | 12/0 |
| raon-blender-rigged-lod2-v1.glb | 3.07 | 15,963 | 1/33 | 12/0 |
| raon-blender-rigged-v1.glb | 13.34 | 72,566 | 1/33 | 12/0 |
| raon-procedural-v1.glb | 0.12 | 4,704 | 0/0 | 0/0 |
| raon-production-lod1-v2.glb | 2.53 | 23,482 | 1/33 | 12/0 |
| raon-production-lod2-v2.glb | 2.00 | 10,744 | 1/33 | 12/0 |
| raon-production-v2.glb | 5.18 | 42,592 | 1/33 | 16/20 |
| raon-triposr-v1.glb | 1.39 | 72,566 | 0/0 | 0/0 |

## 중요 발견

1. **원본 WebP는 기본 glTFast 로더에 직접 사용할 수 없음** — production-v2와 LOD1/2는 EXT_texture_webp 필수이며 22개 내장 이미지가 전부 WebP다. 공식 glTFast 6.20 기본 로더용으로 PNG 파생 파일을 준비했다. 22개 RGBA 픽셀 및 비이미지 bufferView 바이트 동일 검증을 통과했다. 원본 파일은 변경하지 않았다.

2. **현재 GLB는 이미 Y-up, 약 1.779m, 발바닥 거의 0** — 현재 node root·body·hair transforms는 항등이다. raw POSITION 최저 Y=0.00051146385m, 최고 Y=1.77951717m. 양발 X쪽 최저점은 0.0005482462/0.00051146385m. Foot 관절은 Y≈0.14m, Toes는 Y≈0.07m/Z≈+0.16m이며 관절 위치를 발바닥으로 쓰면 안 된다. 시각 wrapper 스케일1, Y=-0.00051146385m로 정적 발 정렬한다. +Z 정면은 양발 Toes 방향에 근거한다. 동적 접지 검증은 별개다.

3. **16개 클립의 존재와 최종 연기 품질은 다름** — Root 노드 이동은 0이고 Hips에 로컬 흔들림이 있다. walk/run의 Hips Z는 ±0.018/±0.03m이며 지속 전진이 없는 제자리 주기다. jump(1초)는 Hips Y가 0.86m로 고정이고 Z가 -0.05..0.28m여서 점프 물리를 대체하지 못한다. motor가 물리 이동을 담당하고 애니메이션은 별도 자식 scene에만 적용해야 한다.

4. **리그는 자동 후보이며 Humanoid Avatar 합격 기록은 아님** — 1 skin/33 joints, 가중치 최대2 영향, 합 오차0, 유한값을 확인했다. LOD0은 표정 모프20개·16클립, LOD1/2는 표정 모프가 없고 12클립이다. 제작 기록의 manual=false 자동 quad remesh와 자동 가중치가 남아 있으며 실제 Unity Editor 스키닝/Avatar/발 미끄러짐 검수는 수행되지 않았다.

5. **이전 Blender inspection의 높이·helper 수는 현재 GLB와 다름** — raon-production-v2-inspection.json은 Blender Z-up 높이1.6355m, helper Icosphere 포함 mesh3과 크게 치우친 hair 좌표를 기록한다. 현재 binary는 Y-up, mesh2이며 Icosphere가 없으므로 그 보고서를 현 파일 좌표나 구성으로 재사용하면 안 된다. Aug31 Unity compatibility report의 현재 binary 통계는 이번 독립 검사와 일치한다.

6. **저장된 미리보기는 완성 캐릭터 품질을 증명하지 않음** — 저장된 production-idle-v2와 idle-preview-v2 이미지에서 얼굴·손 디테일이 뭉개지고 재질 경계가 거칠며 넓은 마젠타 부위/머리 카드의 판 모양이 보인다. 후자는 v1 pilot의 미리보기이고 파일명 v2만으로 production-v2와 동일시할 수 없다. 이 렌더는 현재 Unity 런타임 캡처가 아니므로 현 파일의 재질 누락 원인을 확정할 수 없다.

## 실제 클립 이름과 길이

| 이름 | 초 |
| --- | ---: |
| attackHeavy | 0.8333 |
| attackLight | 0.5000 |
| dodge | 0.7500 |
| guard | 1.2500 |
| hit | 0.3333 |
| idle | 2.5000 |
| jump | 1.0000 |
| land | 0.7500 |
| run | 1.0000 |
| sprint | 0.8333 |
| talkNeutral | 3.1250 |
| walk | 1.2500 |
| expressionSmile | 1.0000 |
| expressionBlink | 0.3750 |
| expressionConcern | 1.1667 |
| expressionTalk | 1.3333 |

LOD1/2에는 expression 4개가 없다. jump/land는 한 번 재생하는 시각 포즈이고 보행 루트 이동을 구동하지 않는다. 별도 fall 클립은 없다. 이름만 보고 최종 루트 모션이나 접지 품질이 갖추어졌다고 해석하지 않는다.

## Unity 파생 파일 보존 검사

- 도구: tools/3d/prepare-raon-unity-runtime.mjs
- 출력: unity/PsycheAdventure/Assets/StreamingAssets/Raon/raon-unity-runtime.glb
- 원본 SHA-256: 68f3a381d9a5d6bbc8845d22c8aa747f35223e6a6344aadd079ac7361e4fbed2
- 출력 SHA-256: d8fe6ac954d634bafd36b67428b071bdd141b69cd80032df89fa8795d2e7ad20
- 출력 크기: 20,174,828 bytes
- 22개 이미지의 decoded RGBA 픽셀 동일, 비이미지 bufferView 1248개 바이트 동일. geometry/rig/morph/animation JSON 값 동일. GLB chunk와 bufferView의 4바이트 정렬, 길이, texture.source 매핑을 검증했다.
- 이미지 MIME은 image/png, EXT_texture_webp 요구 제거. 이는 새 이미지 생성·새 리그·리토폴로지가 아니다.

## 표시 컴포넌트

RaonVisual은 glTFast **6.20.0**의 공식 tarball 소스를 대조했다. Configure/Loading·Ready·Failed/FailureReason/IsReady/Reload를 제공한다. 비활성 상태로 분리된 장면에 로드하고 8재질·22텍스처·33관절·20모프·idle/walk/run을 검사한 뒤 motor 자식 시각 계층에 붙인다. 시각 스케일1, 발 보정 -0.00051146385m, +Z 정면이다. Legacy Animation의 대상 scene을 따로 만들어 물리 motor root를 애니메이션이 건드리지 못하게 했다.

Root의 위치는 모든 기본 클립에서 0이지만 Hips는 움직인다. 특히 jump의 Hips Y 고정/Z 이동 때문에 실제 점프는 Motor가 담당한다. walk/run 속도는 모터 실제 이동량을 읽으므로 벽에 막혀 속도가0이면 idle로 돌아간다. 비활성화·재시도는 취소 토큰과 요청 세대를 검사하고 인스턴스 제거 뒤 importer를 해제한다.

## 근거와 한계

현재 binary의 수치와 Aug31 unity compatibility 보고서는 일치한다. 더 오래된 Blender inspection의 1.635m/Z-up/helper 메시 통계와 production-harness의 v1 기록은 현재 파일과 다르다. fidelity 보고서는 구조 검사와 별도로 보아야 한다. 미리보기의 마젠타는 저장된 렌더의 관찰이며 현재 Unity 재질 실패를 실증한 캡처가 아니다.

읽은 공식 자료: [glTFast 6.20 runtime](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.20/manual/ImportRuntime.html), [shader setup](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.20/manual/ProjectSetup.html), [6.20.0 package source](https://download.packages.unity.com/com.unity.cloud.gltfast/-/com.unity.cloud.gltfast-6.20.0.tgz).

Unity Editor 실행·실제 스키닝·동적 접지·모바일 GPU 성능은 이번 파일 감사로 검증하지 않았다. EditMode 테스트는 작성했지만 Editor가 없는 상태에서 통과로 기록하지 않는다. 실제 플레이·빌드에서 스킨과 머리카락 BLEND/양면, shader variant, 관절 변형, 재시도 수명주기를 이어 확인해야 한다.

현재 fidelity 보고서는 라온을 85/100·verticalSlice로 분류하지만 topology=false, engine=false이며 수동 리토폴로지와 게임 카메라·조명·충돌 검증을 차단 항목으로 명시한다. 이 자동 점수는 최종 아트 품질의 주관적 합격 점수가 아니다. 전체 48명 중 heroProduction은 0명이다.
