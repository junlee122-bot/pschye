# Psyche Character Validation

Unity 6 URP에서 라온 제작 후보 GLB의 실제 변형을 확인하기 위한 최소 검수 프로젝트입니다.

## 사용 순서

1. 저장소 루트에서 `pnpm models:hero:unity-sync`를 실행합니다.
2. Unity Hub로 이 폴더를 Unity 6000.0 이상에서 엽니다.
3. `Assets/Characters/Raon/raon-production-v2.glb`를 선택합니다.
4. `Raonjena > Validation > Validate Selected Character`를 실행합니다.
5. 임포트된 프리팹에 `RaonDeformationStressTest`를 붙이고 12개 클립을 연결합니다.
6. 어깨, 팔꿈치, 손목, 골반, 무릎, 발목, 얼굴, 헤어 카드를 게임 카메라와 근접 카메라에서 확인합니다.

## 판정 범위

- Node 기반 GLB 정적 검사는 저장소의 `pnpm models:hero:unity-audit`가 담당합니다.
- 이 프로젝트는 Unity의 실제 스키닝, 머티리얼 변환, BlendShape, 애니메이션 샘플링을 확인합니다.
- 현재 환경에는 Unity Editor가 설치되어 있지 않으므로 에디터 검수 통과로 기록하지 않습니다.
- 자동 쿼드 리메시는 제작 후보용입니다. 얼굴·어깨·팔꿈치·손·골반·무릎은 최종 단계에서 수동 에지 루프 정리가 필요합니다.

glTF 임포트는 Unity Technologies의 `com.unity.cloud.gltfast` 패키지를 사용합니다.
