# 라온제나 3D 공급자 자동 전환 파이프라인

## 목적

하나의 외부 서비스가 인증, 잔액, 장애 또는 하드웨어 문제로 멈춰도 3D 제작 전체가 중단되지 않도록 검증된 공급자를 순서대로 선택한다.

기본 순서는 다음과 같다.

1. Hi3D 다중 시점 고밀도 PBR 생성
2. Meshy 6 다중 이미지 PBR 생성
3. 로컬 Stability AI TripoSR 단일 이미지 검토용 생성
4. 프로젝트 자체 절차형 프록시

`Stable Fast 3D`와 `Hunyuan3D 2`도 공식 구현을 조사했지만 현재 장비의 Intel UHD 620 1 GB 환경에서는 안정적으로 실행할 수 없다. 무거운 모델과 체크포인트를 설치해 디스크를 소진하지 않고, 상태 보고서에 비활성 사유만 기록한다.

## 안전 규칙

클라우드 생성은 아래 두 조건을 동시에 충족해야 한다.

- 명령에 `--execute`가 있다.
- `.env.3d.local`의 `RAONJENA_3D_ALLOW_SPEND=true`가 설정되어 있다.

둘 중 하나라도 빠지면 Hi3D와 Meshy를 건너뛰고 무료 로컬 공급자를 사용한다. API 키와 비밀 키는 로그나 상태 JSON에 기록하지 않는다.

## 환경 변수

```dotenv
HITEM3D_CLIENT_ID=
HITEM3D_CLIENT_SECRET=
MESHY_API_KEY=
TRIPO_API_KEY=
RAONJENA_3D_ALLOW_SPEND=false
```

`TRIPO_API_KEY`는 후속 클라우드 어댑터를 위한 예약 항목이다. 현재 자동 실행 공급자는 Hi3D, Meshy, 로컬 TripoSR, 절차형 마켓이다.

## 상태와 계획

```powershell
pnpm models:providers:status
pnpm models:providers:plan
pnpm models:meshy:plan -- --character=raon
```

공급자 상태는 `artifacts/3d/provider-status.json`에 기록된다. 이 파일에는 인증 성공 여부, 잔액 유무, 로컬 런타임 준비 상태, 선택된 공급자, 폴백 이유만 들어간다.

## 자동 생성

무료 로컬 폴백만 허용:

```powershell
pnpm models:providers:generate -- --character=raon
```

유료 클라우드 공급자도 허용:

```powershell
$env:RAONJENA_3D_ALLOW_SPEND='true'
pnpm models:providers:generate -- --character=raon --execute
```

특정 공급자 고정:

```powershell
pnpm models:providers:generate -- --provider=meshy --character=raon --execute
```

## 로컬 CPU 배치 생성

캐릭터 시트에서 정면·우측 입력을 먼저 추출한다.

```powershell
pnpm models:hitem:prepare -- --character=haechan
```

TripoSR 모델과 배경 제거 세션을 한 번만 메모리에 올린 뒤 여러 캐릭터를 연속 생성한다.

```powershell
pnpm models:triposr:batch -- --character=hadori,kazrin,kain,leo --resolution=160
pnpm models:triposr:batch -- --character=haechan,lami,jinhwon,maru,nabi-nia --resolution=160
```

각 결과는 Y축 상향, 1.78m 높이, 지면 원점으로 자동 정규화된다. GLB 검사에 통과하면
`public/data/model-provider-overrides.json`에 `review` 상태로 승격된다.

현재 실제 AI 검수 메시가 연결된 인물은 라온, 하도리, 카즈린, 카인, 레오, 해찬, 라미, 진훤, 마루,
나비/니아의 10명이다. 나머지 38명은 게임 내 실루엣·장비 배치 검토를 위한 절차형 프록시다.

## Meshy 제작 설정

라온은 준비된 정면, 후면, 좌측, 우측 4면도를 `multi-image-to-3d`에 전달한다.

- Meshy 6
- A 포즈
- 삼각형 리메시
- 목표 100,000 폴리곤
- 2K 텍스처
- PBR 맵
- 조명 제거
- GLB만 반환
- 바닥 원점과 자동 크기
- 정면, 우측, 후면, 좌측 검토 썸네일

텍스처 프롬프트는 추가 비용과 원화 왜곡을 피하기 위해 사용하지 않는다.

## 승격 기준

생성물이 다음 자동 검사를 통과해야 `public/data/model-provider-overrides.json`의 `review` 모델로 등록된다.

- 올바른 GLB 2.0 헤더와 파일 길이
- 로컬 TripoSR: 100 KB 이상, 메시·노드 각각 하나 이상, 10,000~1,500,000 삼각형
- Hi3D·Meshy: 500 KB 이상, 메시·재질·노드 각각 하나 이상, 10,000~500,000 삼각형
- Y축 상향, 지면 정렬, 규격 높이 확인
- 브라우저의 `model-viewer`에서 모든 `review` GLB 순차 로드 확인

자동 검사는 캐릭터 닮음, 손가락 구조, 얼굴 비율, 장비 분리, 관절 변형을 보증하지 않는다. 따라서 클라우드 결과도 곧바로 `production`으로 승격하지 않는다.

## 공식 참고 자료

- Meshy Image to 3D: https://docs.meshy.ai/en/api/image-to-3d
- Meshy Multi-Image to 3D: https://docs.meshy.ai/en/api/multi-image-to-3d
- Meshy Balance API: https://docs.meshy.ai/en/api/balance
- Tripo Image to Model: https://developers.tripo3d.ai/en/docs/generation-image-to-model
- Stability AI Stable Fast 3D: https://github.com/Stability-AI/stable-fast-3d
- Tencent Hunyuan3D 2: https://github.com/Tencent-Hunyuan/Hunyuan3D-2
