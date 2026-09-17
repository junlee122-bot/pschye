# 2026년 9월 라온제나 작업 보고서와 검증 근거

이 폴더는 로컬 작업 정리에 앞서 보존한 역사 자료입니다. 현재 개발 재개 순서는 [현재 인계 안내](../../HANDOFF_CURRENT.md) → [3D 조작 기반 계약](../../THIRD_PERSON_FOUNDATION.md) → [Unity 프로젝트 안내](../../../unity/PsycheAdventure/README.md)를 우선합니다.

9묶음은 소스 구현과 정적 점검까지 진행됐고 Unity Editor 컴파일·테스트 34개·실제 플레이·Windows 빌드 검증은 미실행 상태입니다. 1~8묶음의 웹 검증 성공은 Unity 실행 성공을 뜻하지 않습니다. 역사 보고서의 커밋, 경로, 테스트 개수, 남은 작업은 작성 시점의 기록입니다.

## 작업 묶음

| 묶음 | 작성 당시 상태 | 보고서 |
|---|---|---|
| 1 | 웹 기능 구현·해당 시점 검증 완료 | [보고서](%EC%B2%AB_%EC%9E%91%EC%97%85%EB%AC%B6%EC%9D%8C_%EC%99%84%EB%A3%8C%EB%B3%B4%EA%B3%A0%EC%84%9C.md) |
| 2 | 웹 기능 구현·해당 시점 검증 완료 | [보고서](%EB%91%90%EB%B2%88%EC%A7%B8_%EC%9E%91%EC%97%85%EB%AC%B6%EC%9D%8C_%EC%99%84%EB%A3%8C%EB%B3%B4%EA%B3%A0%EC%84%9C.md) |
| 3 | 웹 기능 구현·해당 시점 검증 완료 | [보고서](%EC%84%B8%EB%B2%88%EC%A7%B8_%EC%9E%91%EC%97%85%EB%AC%B6%EC%9D%8C_%EC%99%84%EB%A3%8C%EB%B3%B4%EA%B3%A0%EC%84%9C.md) |
| 4 | 웹 기능 구현·해당 시점 검증 완료 | [보고서](%EB%84%A4%EB%B2%88%EC%A7%B8_%EC%9E%91%EC%97%85%EB%AC%B6%EC%9D%8C_%EC%99%84%EB%A3%8C%EB%B3%B4%EA%B3%A0%EC%84%9C.md) |
| 5 | 웹 기능 구현·해당 시점 검증 완료 | [보고서](%EB%8B%A4%EC%84%AF%EB%B2%88%EC%A7%B8_%EC%9E%91%EC%97%85%EB%AC%B6%EC%9D%8C_%EC%99%84%EB%A3%8C%EB%B3%B4%EA%B3%A0%EC%84%9C.md) |
| 6 | 웹 기능 구현·해당 시점 검증 완료 | [보고서](%EC%97%AC%EC%84%AF%EB%B2%88%EC%A7%B8_%EC%9E%91%EC%97%85%EB%AC%B6%EC%9D%8C_%EC%99%84%EB%A3%8C%EB%B3%B4%EA%B3%A0%EC%84%9C.md) |
| 7 | 웹 기능 구현·해당 시점 검증 완료 | [보고서](%EC%9D%BC%EA%B3%B1%EB%B2%88%EC%A7%B8_%EC%9E%91%EC%97%85%EB%AC%B6%EC%9D%8C_%EC%99%84%EB%A3%8C%EB%B3%B4%EA%B3%A0%EC%84%9C.md) |
| 8 | 웹 여정·실조작 검증 완료 | [보고서](%EC%97%AC%EB%8D%9F%EB%B2%88%EC%A7%B8_%EC%9E%91%EC%97%85%EB%AC%B6%EC%9D%8C_%EA%B2%80%EC%A6%9D%EB%B3%B4%EA%B3%A0%EC%84%9C.md) |
| 9 | Unity 소스 구현·정적 점검, 엔진 검증 대기 | [보고서](%EC%95%84%ED%99%89%EB%B2%88%EC%A7%B8_%EC%9E%91%EC%97%85%EB%AC%B6%EC%9D%8C_%EC%A7%84%ED%96%89%EB%B3%B4%EA%B3%A0%EC%84%9C.md) |

## 읽을 자료

- [재개 점검보고서](%EB%9D%BC%EC%98%A8%EC%A0%9C%EB%82%98_%EC%9E%AC%EA%B0%9C_%EC%A0%90%EA%B2%80%EB%B3%B4%EA%B3%A0%EC%84%9C.md)
- [전체 여정 검증 계획과 근거](%EC%A0%84%EC%B2%B4_%EC%97%AC%EC%A0%95_%EA%B2%80%EC%A6%9D_%EA%B3%84%ED%9A%8D%EA%B3%BC_%EA%B7%BC%EA%B1%B0.md)
- [젤다·붉은사막급 제작 조사](../../AAA_PRODUCTION_RESEARCH.md)
- [8묶음 실조작 증빙](%EC%97%AC%EB%8D%9F%EB%B2%88%EC%A7%B8_%EC%8B%A4%EC%A1%B0%EC%9E%91_%EA%B7%BC%EA%B1%B0/README.md)
- [9묶음 검증 요약](%EC%95%84%ED%99%89%EB%B2%88%EC%A7%B8_%EC%A0%90%EA%B2%80%EA%B7%BC%EA%B1%B0/%EA%B2%80%EC%A6%9D%EC%9A%94%EC%95%BD.json)
- [이관 목록과 SHA-256](migration-manifest.json)

## 보존 방식과 한계

최종 outputs의 보고서·검증 JSON·스크린샷과 해당 증빙 묶음에 포함된 작은 재현 도구를 보존했습니다. 중간 작업 폴더의 임시 서버·로그·초안과 대용량 복구 ZIP은 이 폴더에 복제하지 않았습니다. 원본과 동일한 파일이 이미 저장소에 있으면 기존 파일을 참조하고 동일 내용의 출력끼리도 중복을 제거했습니다.

로컬 사용자 경로는 `<LOCAL_WORKSPACE>`, `<LOCAL_REPOSITORY>`, `<LOCAL_USER_HOME>` 등으로 익명화했습니다. Markdown 링크는 가능한 경우 실제 저장소 상대 경로로 고쳤습니다. 역사 JSON 안의 파일 목록·체크포인트·원래 해시는 당시 기록을 보존하므로 현재 폴더에 동일 경로가 모두 있다는 뜻이 아닙니다. 실제 보존 위치와 변환 전후 해시는 migration-manifest.json이 기준입니다. 재현 도구는 당시 조사 보조 자료이며, 현재 공식 실행 절차는 프로젝트 README를 따릅니다.

이 이관은 파일 보존 작업이며 새 엔진 실행·플레이 검증을 수행하지 않았습니다. 자동 토큰 패턴 검사에서 실제 자격증명 형태는 발견되지 않았고 Nintendo `ask-the-developer` URL의 부분 일치는 오탐으로 분류했습니다. 이는 모든 가능한 비밀정보를 검출한다는 보증은 아닙니다.

## 기존 파일로 합친 자료

- `outputs/아홉번째_점검근거/raon-unity-runtime-conversion.json` → [artifacts/3d/unity/raon-unity-runtime-conversion.json](../../../artifacts/3d/unity/raon-unity-runtime-conversion.json)
- `outputs/여덟번째_실조작_근거/CAMPAIGN_BATTLE_RESUME.md` → [docs/CAMPAIGN_BATTLE_RESUME.md](../../CAMPAIGN_BATTLE_RESUME.md)
- `outputs/여덟번째_실조작_근거/CAPTAIN_TRIALS_PLAYABLE.md` → [docs/CAPTAIN_TRIALS_PLAYABLE.md](../../CAPTAIN_TRIALS_PLAYABLE.md)
- `outputs/여덟번째_실조작_근거/eighth-batch-before-native-fixes-build-verification.json` → [docs/reports/2026-09-handoff/eighth-batch-build-verification.json](eighth-batch-build-verification.json)
- `outputs/여덟번째_실조작_근거/FIELD_EXAM_PLAYABLE.md` → [docs/FIELD_EXAM_PLAYABLE.md](../../FIELD_EXAM_PLAYABLE.md)
- `outputs/여덟번째_실조작_근거/native-battle-four-suspended-profile.json` → [docs/reports/2026-09-handoff/여덟번째_실조작_근거/native-battle-four-before-resume-profile.json](%EC%97%AC%EB%8D%9F%EB%B2%88%EC%A7%B8_%EC%8B%A4%EC%A1%B0%EC%9E%91_%EA%B7%BC%EA%B1%B0/native-battle-four-before-resume-profile.json)
- `outputs/여덟번째_실조작_근거/native-battle-suspended-profile.json` → [docs/reports/2026-09-handoff/여덟번째_실조작_근거/native-battle-before-resume-profile.json](%EC%97%AC%EB%8D%9F%EB%B2%88%EC%A7%B8_%EC%8B%A4%EC%A1%B0%EC%9E%91_%EA%B7%BC%EA%B1%B0/native-battle-before-resume-profile.json)
- `outputs/여덟번째_실조작_근거/PETAL_TRAINING_PLAYABLE.md` → [docs/PETAL_TRAINING_PLAYABLE.md](../../PETAL_TRAINING_PLAYABLE.md)
- `outputs/여덟번째_실조작_근거/VILLAGE_PLAYABLE_LOOP.md` → [docs/VILLAGE_PLAYABLE_LOOP.md](../../VILLAGE_PLAYABLE_LOOP.md)
- `outputs/젤다_붉은사막급_제작조사.md` → [docs/AAA_PRODUCTION_RESEARCH.md](../../AAA_PRODUCTION_RESEARCH.md)
