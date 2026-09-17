# 9묶음 최종 정적 정합성 검사

검토 시각: 2026-09-15T06:18:41.573Z
Git 기준: 3f7922abbeabc0ef936ee56f268bc7d394db58db

**정적 검사 통과, 확정 오류 0건.** Unity Editor 컴파일·테스트·플레이어 빌드와 실조작을 실행한 결과는 아니다. launcher/docs는 검토 범위에서 제외했다.

## 파일과 참조

| 항목 | 결과 |
|---|---|
| C# 소스 | 12개 |
| asmdef | 4개, 프로젝트/공식 패키지 이름으로 참조 해소 |
| 메타와 GUID | 28개, GUID 28개, 중복 0건 |
| 누락·고아 메타 | 0건, 폴더 메타의 folderAsset도 검사 |
| 장면 로컬 객체 ID | 4개, 중복/미해결 참조 0건 |
| 장면 스크립트 | FoundationBootstrap.cs GUID로 정확히 연결, MonoScript fileID 11500000 |
| 빌드 장면 | RaonFoundation.unity 1개, 경로·GUID 모두 존재 |
| 런타임 모델 | 지정 StreamingAssets 경로에 20,174,828 bytes 파일 존재 |

manifest JSON과 4개 asmdef JSON 파싱을 확인했다. Runtime → Editor/Test 어셈블리 참조는 없다. EditMode/Editor는 Editor 플랫폼으로 제한되고 테스트 어셈블리에 TestAssemblies 참조가 있다. URP/Core 어셈블리 이름은 Unity 공식 6000.0 소스와, glTFast 이름은 내려받은 6.20.0 공식 패키지 asmdef와 대조했다. 패키지 관리자에서 정확한 전체 의존성 그래프를 실제 해결한 것은 아니다.

FoundationPipeline/Renderer 및 URP 글로벌 설정은 PrepareProject가 Editor에서 만드는 파일이므로 아직 생성되지 않은 것을 깨진 scene GUID로 판정하지 않았다. 실제 첫 프로젝트 준비와 Windows 빌드에서 생성·직렬화 여부를 확인해야 한다.

## HUD Font와 모듈

HUD의 Font는 UnityEngine.TextRenderingModule의 엔진 API이고, Unity 6000.0 공식 소스에 CreateDynamicFontFromOSFont(string[], int)가 공개돼 있다. 공식 IMGUI의 GUIStyle.font 또한 직접 이 Font를 사용한다. [Font 구현](https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/6000.0/Modules/TextRendering/TextRendering.bindings.cs), [GUIStyle 구현](https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/6000.0/Modules/IMGUI/GUIStyle.bindings.cs).

공식 [Unity 6.0 Built-in package 목록](https://docs.unity3d.com/6000.0/Documentation/Manual/pack-build.html)에는 별도의 com.unity.modules.textrendering 패키지가 없다. 현재 IMGUI/UI 활성화와 기본 엔진 참조를 유지한 Runtime asmdef에 별도의 Font UPM 패키지를 추가해야 한다는 근거는 찾지 못했다. Font가 다른 엔진 DLL에 속한다는 사실만으로 manifest 의존성 누락이라고 판단하지 않았다. 정확한 6000.0.75f1 컴파일 및 Windows 한글 렌더링은 미확인이다.

| 사용 기능 | 현재 연결 |
|---|---|
| CharacterController, Physics | com.unity.modules.physics |
| Legacy Animation | com.unity.modules.animation |
| AudioListener/Light/Camera | audio 활성화 및 기본 Core 엔진 참조 |
| GUI/GUILayout/GUIStyle | com.unity.modules.imgui |
| Font | 엔진 TextRendering API, 별도 UPM 패키지 누락 근거 없음 |
| Input.GetKey, 마우스 | 기존 Input API, activeInputHandler 0 |
| JSON, GLB 다운로드/PNG 처리 | jsonserialize/unitywebrequest/unitywebrequesttexture/imageconversion 활성화 |
| URP/glTFast | manifest 버전 고정, 공식 어셈블리 이름 일치 |

## 원본 보존

Git HEAD와 비교해 src(117 tracked files), public(2,181), unity/PsycheCharacterValidation(9)에 수정·삭제·추가 파일이 없다. 루트 package.json, pnpm-lock.yaml, index.html, vite/TypeScript/ESLint 설정도 변경되지 않았다. 저장소에 별도 web/ 디렉터리는 없으며 실제 웹 소스인 루트 설정과 src/public을 검사했다. 이 검사는 추적 파일의 staged/unstaged 변경 및 비무시 untracked 파일에 대한 Git 기준 검사다.

검사한 소스·메타·설정의 SHA-256과 GUID 해소 목록은 ninth-static-audit.json에 기록했다. 이 리뷰는 제품 파일을 수정하지 않았고 Unity 설치·원격 변경·커밋을 수행하지 않았다.
