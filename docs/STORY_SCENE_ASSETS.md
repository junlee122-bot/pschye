# 라온제나 스토리 장면 에셋

## 범위

- 대서사 에피소드: 86개
- 장면 비트: 516개
- 에피소드 연출 변형: 탐색, 대화, 전투, 여운 4종
- 에피소드별 썸네일: 1종
- 에피소드별 장면 비트: 6종
- 게임용 파생 에셋: 총 946개
- 신규 환경 원화 아틀라스: 12장, 72개 지역
- 기존 고유 지역 원화 재활용: 14개 지역

모든 대서사 에피소드는 `public/art/story/scenes/{episodeId}` 아래에 다음 구조로 저장된다.

```text
explore.webp
dialogue.webp
battle.webp
aftermath.webp
thumb.webp
beats/01.webp
beats/02.webp
beats/03.webp
beats/04.webp
beats/05.webp
beats/06.webp
```

## 아틀라스 구성

| 아틀라스 | 주요 구간 |
| --- | --- |
| 01 | 수도 입성, 적성 검사, 현장 시험, 마루 수련 |
| 02 | 조장 선발전, 3기 생존자, 6기 갈등 |
| 03 | 삭제 기록, 니아 알현, 가람 회담, 처형대 과거 |
| 04 | 해찬·진훤·앤·나비·마루·가람 영입 전사 |
| 05 | 여섯 군단 결성, 공동 작전, 수도 공략 |
| 06 | 라미의 빛, 반란군 분열, 해찬의 극의 |
| 07 | 해찬 귀환, 제국 분열, 6기 배신 |
| 08 | 1~7기 계승, 라온과 해찬의 수련 |
| 09 | 삼파전, 진훤의 죽음, 나비 폭주 |
| 10 | 제7기 결전, 라온류 완성, 공존 결말 |
| 11 | 라미의 유년기, 저주받은 땅, 무효화 각성 |
| 12 | 체능의 어머니, 아케로의 빛, 해찬을 찾아감 |

원본 아틀라스는 `public/art/story/scenes/sources`에 보존한다. 생성 프롬프트는 기존 마을·임무·프시케 세대 아트의 서양 다크 판타지 회화풍을 기준으로 삼았으며, 3열 2행 장면과 마젠타 분리선을 요구해 자동 크롭 안정성을 확보했다.

## 런타임 사용

`src/data/sceneAssets.ts`의 헬퍼를 사용한다.

```ts
getStoryEpisodeAsset(episodeId, 'explore');
getStoryEpisodeThumbnail(episodeId);
getStoryBeatAsset(episodeId, localOrder);
```

`StoryAtlas`는 에피소드별 네 연출을 즉시 전환하고 각 장면 카드에 대응하는 비트 이미지를 표시한다. 라온의 입단 스토리도 6장 이후 신규 에셋을 직접 사용한다.

## 재생성 및 검증

```powershell
python tools/generate_story_scene_assets.py
python tools/generate_story_scene_assets.py --validate
```

생성기는 이미 검증된 파일을 재사용한다. `manifest.json`에는 에피소드·비트·총 에셋 수가 기록된다.

## 아트 방향

- 서양 중세·고딕 건축과 전후 산업 잔해의 결합
- 흑철, 오래된 금장, 보랏빛 신성 잔광을 핵심 팔레트로 사용
- 인물보다 장소와 임무 목적이 먼저 읽히는 와이드 구도
- 탐색은 중립, 대화는 따뜻한 국부광, 전투는 차갑고 강한 대비, 여운은 저채도 황혼으로 구분
- UI 문구나 워터마크를 원화에 포함하지 않음

