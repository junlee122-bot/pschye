# 라온제나 3D 캐릭터 피델리티 파이프라인

## 결론

지금의 TripoSR·Hi3D·Meshy 결과는 **형태 검토용 마켓(maquette)** 이다. 캐릭터가 실제 사람처럼 느껴지려면 폴리곤 수를 올리는 것보다 아래 네 요소를 일관되게 완성해야 한다.

1. 얼굴과 몸의 해부학, 실루엣, 관절 변형이 자연스러울 것
2. 피부·눈·머리카락·금속·천이 서로 다른 빛 반응을 가질 것
3. 숨, 시선, 눈 깜빡임, 무게 중심, 손가락 같은 미세 움직임이 있을 것
4. 대화 클로즈업과 실제 게임 카메라 양쪽에서 같은 캐릭터로 보일 것

고폴리의 세부를 저폴리 게임 메시로 베이크하는 방식은 Blender와 Substance의 공식 파이프라인과 일치한다. Blender는 멀티레졸루션 고해상도 정보를 노멀·디스플레이스먼트로 베이크하는 과정을 설명하고, Substance Painter는 고폴리 정보를 저폴리에 옮겨 품질과 런타임 비용을 동시에 관리한다. [Blender Render Baking](https://docs.blender.org/manual/ka/4.5/render/cycles/baking.html), [Substance 3D Painter Baking](https://helpx.adobe.com/africa/substance-3d-painter/using/baking.html)

## 제작 단계

### 0. 캐릭터 기준 원화

- 정면·측면·후면, 얼굴 확대, 장비 분해도, 키와 신체 비율을 고정한다.
- 같은 의상에 장식이 매번 달라지는 생성 이미지 문제를 먼저 제거한다.
- 현재 만든 `20개 시기 바리에이션`은 모두 별도 몸을 만들지 않고, 공용 신체 + 모듈식 의상 + 헤어 + 상처/노화 텍스처로 재구성한다.

### 1. AI 재구성 마켓

- TripoSR/Hi3D/Meshy로 1차 볼륨을 얻는다.
- 목적은 실루엣·의상 질량·무기 크기·카메라 가독성 확인이다.
- 이 단계의 메시를 그대로 리깅하거나 출시하지 않는다. 뒤틀린 손, 융합된 머리카락, 의상 내부 면, 불규칙 토폴로지가 변형과 텍스처를 망가뜨리기 때문이다.

### 2. 고폴리 스컬프

- Blender Sculpt 또는 ZBrush에서 얼굴, 손, 관절, 갑옷 모서리, 봉제선, 가죽 주름을 다시 만든다.
- 피부의 큰 형태 → 중간 형태 → 모공 같은 미세 형태 순으로 작업한다.
- 머리카락은 덩어리 실루엣을 먼저 만든 뒤 실제 게임용 헤어 카드 또는 곡선 기반 그룸으로 전환한다.

### 3. 수동 리토폴로지

- LOD0 기준 55k~95k 삼각형을 목표로 한다.
- 눈꺼풀, 입술, 어깨, 팔꿈치, 손가락, 골반, 무릎에 변형 루프를 배치한다.
- 얼굴과 손은 가까이 보이므로 예산을 우선 배분하고, 망토 안쪽·보이지 않는 갑옷 뒷면은 줄인다.

### 4. UV와 PBR 베이크

- 얼굴 4K, 몸 4K, 장비 4K, 머리 2K를 영웅 캐릭터 기준으로 사용한다.
- Base Color, Normal, Metallic, Roughness, AO를 필수 채널로 둔다.
- 피부는 금속 갑옷처럼 선명한 반사를 내면 안 되고, 눈은 각막과 안구를 분리해야 한다.
- 금속의 사용 흔적은 임의의 노이즈가 아니라 모서리·접촉부·전투 방향에 따라 배치한다.

### 5. 리그와 변형

- 공용 휴머노이드 스켈레톤, 무기 소켓, 망토/머리 보조본을 사용한다.
- A/T 포즈만 확인하지 않고 웅크리기, 검 머리 위 들기, 창 찌르기, 한쪽 무릎 착지, 극단 표정으로 스트레스 테스트한다.
- 어깨·팔꿈치·손목·골반은 보정 블렌드셰이프를 둔다. Epic의 MetaHuman 컴포넌트도 신체 보정과 얼굴 애니메이션을 LOD별 품질/성능 옵션으로 다룬다. [MetaHuman Component](https://dev.epicgames.com/documentation/metahuman/the-metahuman-component-for-unreal-engine?lang=en-US)

### 6. 얼굴 생동감

- 최소 20개 핵심 표정, 주연은 ARKit 호환 52개 표정 커브를 목표로 한다.
- 별도 눈 깜빡임, 시선, 동공, 턱, 혀, 볼·목 보정을 둔다.
- 대사 없는 장면에도 3~7초 간격의 비동기 눈 깜빡임, 호흡, 미세 시선 이동을 넣는다.
- MetaHuman Animator는 비디오·오디오·깊이 입력에서 얼굴/몸 애니메이션을 생성하고, 표정 커브와 리타기팅 워크플로를 제공한다. 라온제나가 Unreal을 쓰지 않더라도 **표정 커브 수와 캡처→클린업→리타기팅 구조**는 품질 기준으로 참고할 수 있다. [MetaHuman Animator](https://dev.epicgames.com/documentation/metahuman/metahuman-animator-in-unreal-engine)

### 7. 애니메이션

- 공용: idle, walk, run, sprint, turn, jump, fall, land, dodge, light hit, heavy hit, down, interaction.
- 개인: 기본 연계, 강공격, 체능 기술, 시그니처, 극의/최종기.
- 모션캡처 원본을 그대로 쓰지 않고 발 미끄러짐, 손-무기 접촉, 무게 중심, 실루엣 포즈를 수동 클린업한다.
- Unity Animation Rigging은 IK, 조준, 상호작용과 보조 변형 제약을 제공하므로 발 접지, 손잡이 고정, 시선 추적에 사용한다. [Unity Animation Rigging](https://docs.unity3d.com/kr/Packages/com.unity.animation.rigging%400.2/manual/index.html)

### 8. LOD와 런타임 검증

- LOD0 100%, LOD1 약 55%, LOD2 약 22%, 원거리 임포스터를 기본으로 한다.
- 얼굴 애니메이션·보조본·천 시뮬레이션도 거리에 따라 단계적으로 끈다.
- Unity의 LOD Group은 화면 크기에 따라 저비용 메시로 전환해 원거리 GPU 비용을 줄인다. [Unity LOD](https://docs.unity3d.com/es/current/Manual/LevelOfDetail.html)
- 검증은 흰 스튜디오가 아니라 실제 첫 마을 조명, 비·밤, 전투 카메라, 대화 클로즈업에서 진행한다.

## 라온제나 권장 툴 체인

| 단계 | 현재 권장 | 역할 |
|---|---|---|
| 기준 원화 | 생성 이미지 + 수동 페인트오버 | 정체성·의상 규칙 고정 |
| AI 마켓 | Hi3D/Meshy/TripoSR | 빠른 볼륨 검증 |
| 고폴리/리토폴로지 | Blender | 스컬프, 토폴로지, UV, 베이크 |
| 텍스처 | Substance 3D Painter 또는 Blender | PBR 재질과 마모 |
| 리그 | Blender Rigify 기반 커스텀 리그 | 공용 몸·얼굴·무기 소켓 |
| 엔진 | Unity 6 URP | 현재 하드웨어에서 버티컬 슬라이스 제작 |
| 얼굴 캡처 | ARKit 52 호환 커브 + 수동 클린업 | 대화와 감정 연기 |

## 현재 실행된 라온 파일럿

- `public/art/3d-inputs/raon-turnaround-v2.png`: 정면·측면·후면 비율을 통일한 신규 턴어라운드.
- `public/models/characters/raon/raon-blender-rigged-v1.glb`: Blender 4.5 LTS에서 만든 33본 휴머노이드 리깅 파일럿.
- `public/models/characters/raon/raon-blender-rigged-lod1-v1.glb`: 39,909 삼각형 LOD1.
- `public/models/characters/raon/raon-blender-rigged-lod2-v1.glb`: 15,963 삼각형 LOD2.
- 이동·전투·대화용 기본 애니메이션 12개를 포함한다.
- 피부·머리·셔츠·코트·가죽·금속·금장 역할을 분리한 7개 스타일드 PBR 재질 슬롯을 적용했다.
- 실제 게임의 모델 검수실에서 12개 클립 선택·재생, GLB 로드, LOD 메타데이터를 브라우저 검증했다.

현재 단계는 **완제품이 아니다.** 기존 TripoSR 표면에 자동 웨이트와 역할별 단색 PBR 재질을 적용한 리깅 파일럿이다. 수동 리토폴로지·헤어 카드·고해상도 PBR 텍스처 베이크·얼굴 표정·Unity 변형 검수가 남아 있다. 자동 감사도 이 미완료 항목을 통과시키지 않는다.

## 우선순위

모든 인물을 동시에 최종화하지 않는다.

1. 라온: 전체 품질 기준을 세우는 히어로 자산
2. 하도리·카즈린: 체형과 머리카락이 다른 두 변형 검증
3. 카인·레오·크리스: 공용 남성 리그와 의상 모듈 검증
4. 해찬·라미·나비/니아: 과거/현재, 장애, 이중 페르소나 검증
5. 나머지 인물: 승인된 공용 규격으로 대량 생산

현재 `pnpm models:fidelity`는 GLB의 메시·재질·스킨·표정·애니메이션·LOD를 점검하고, 단순 실루엣 마켓이 최종 자산으로 오인되는 것을 막는다.
