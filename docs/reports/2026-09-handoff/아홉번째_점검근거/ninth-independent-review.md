# 9묶음 Unity 소스 독립 리뷰

- 검토일: 2026-09-15
- 범위: `unity/PsycheAdventure/Assets/Adventure` C#와 asmdef, Packages/manifest.json, ProjectSettings.asset
- 방식: 읽기만 수행. Unity Editor 실행·컴파일·EditMode/PlayMode 테스트·Windows 플레이어 빌드·실조작은 수행하지 않음.
- 소스는 작성 중인 공유 작업 트리의 스냅샷이며, 아래 결론은 Unity 실행 통과를 의미하지 않음.

## 결론

현재 읽은 코드에서 근거가 충분한 공개 API 호출 오류 또는 반드시 발생하는 수명/입력 버그를 확인하지 못했다. 확정 finding은 0건이다. 이 결과만으로 9묶음의 엔진 검증이 완료됐다고 판단할 수 없다.

## 대조한 항목

1. glTFast **6.20.0 실제 패키지 소스**의 `GltfImport(logger:)`, `Load(string, ImportSettings, CancellationToken)`, `InstantiateMainSceneAsync(IInstantiator, CancellationToken)`, `GameObjectInstantiator` 생성자와 `InstantiationSettings` 속성은 RaonVisual의 호출 형태와 일치한다. `SceneInstance.LegacyAnimation`, `MaterialCount`, `TextureCount`, `GetMaterial`, `GetTexture`, `GetBindPoses` 또한 공개 API다. manifest에 animation/imageconversion/unitywebrequest 모듈이 있으며 glTFast의 대응 기능 조건을 충족한다.
2. `SceneObjectCreation.Always`는 Animation을 별도 장면 객체에 붙이므로 물리 모터 또는 시각 래퍼 Transform과 애니메이션 루트가 섞이지 않는다. 비활성 staging에서 완료·검증하고 마지막에 부모를 연결하는 흐름도 패키지 구현과 맞는다.
3. RaonVisual은 로드 세대와 CancellationToken을 동시에 검사한다. 비활성/재로드에서 세대가 바뀌므로 오래된 continuation이 완료 인스턴스를 다시 연결하지 않는다. 취소된 staging과 importer는 finally에서 정리하며, 활성 인스턴스 교체에서는 렌더러 파괴 뒤 importer를 Dispose하려는 순서가 명시돼 있다. 실제 취소 중 native resource 반환 여부는 Editor 실험이 필요하다.
4. 입력 드라이버가 사용하는 모터/카메라/시각 컴포넌트 공개 속성과 함수가 정의돼 있다. 준비 전 조작 차단, Esc 일시정지, 포커스 상실 시 일시정지, 재개 시 마우스 델타 초기화, 모터 비활성 시 이동 입력/평면 속도 초기화가 연결돼 있다.
5. ResourceReloader는 Unity Graphics 공식 6000.0 소스의 **Core.Runtime** 아래에서 `#if UNITY_EDITOR`로 공개된다. `Unity.RenderPipelines.Core.Editor` 참조가 없다는 이유로 컴파일 오류라고 판단하지 않았다. UniversalRenderPipelineAsset.Create 또한 Editor 조건부 공개 API다.
6. 공식 6000.0 URP 소스의 EnsureGlobalSettings 오버라이드는 URP 글로벌 설정 준비를 호출한다. Unity 엔진의 InternalCreatePipeline이 이를 CreatePipeline보다 먼저 실행한다. 수동으로 internal Ensure를 호출해야 한다는 finding을 만들지 않았다.
7. glTFast 6.20의 `Shader Graphs/glTF-pbrMetallicRoughness` 이름과 URP Lit 이름은 PreserveRuntimeShaders의 이름과 맞다. Runtime GLB 로드에 필요한 셰이더를 Always Included에 넣는 접근은 패키지 문서가 설명하는 보존 방법 중 하나다. 이것은 실제 Windows 빌드의 모든 필요한 variant가 유효하다는 증거는 아니다.

## 실행으로 남은 확인

- Unity **6000.0.75f1 + URP17.0.3**의 실제 패키지 해결, 전체 C# 컴파일, 최초 준비 후 장면 열기. 로컬 URP exact 패키지 폴더는 검토 시 비어 있었으므로 URP 부분은 공식 6000.0/staging 소스와 대조했으며 정확한 17.0.3 패키지 컴파일로 확정하지 않았다.
- 새 프로젝트의 batchmode 초기화·BuildWindows, 글로벌 렌더 설정 생성/등록, 런타임 Shader.Find 및 alpha-blend/normal 등 재질 variant 확인.
- GLB 로드 중/인스턴스 생성 중 비활성화, 연속 재로드, 장면 닫기, Play Mode 종료 후 오류와 누수 여부.
- 평지/계단/경사/천장/모서리 CharacterController 및 카메라 충돌. 작성된 테스트의 존재와 테스트 통과는 구별해야 한다.
- 실제 모델 정면/스케일/접지/피부·머리카락 재질/애니메이션의 관절 변형, Windows HUD의 한글과 작은 창 접근성.

## 근거 위치

- 로컬 공식 패키지: `work/ninth-gltfast-6.20/package/Runtime/Scripts/GltfImport.cs`, `GameObjectInstantiator.cs`, `ImportSettings.cs`, `InstantiationSettings.cs`, `Logging/CollectingLogger.cs`, `Material/ShaderGraphMaterialGenerator.cs`, `Documentation~/ProjectSetup.md`, `package.json`.
- [Unity 공식 ResourceReloader 소스](https://raw.githubusercontent.com/Unity-Technologies/Graphics/6000.0/staging/Packages/com.unity.render-pipelines.core/Runtime/Utilities/ResourceReloader.cs)
- [Unity 공식 URP Asset 소스](https://raw.githubusercontent.com/Unity-Technologies/Graphics/6000.0/staging/Packages/com.unity.render-pipelines.universal/Runtime/Data/UniversalRenderPipelineAsset.cs)
- [Unity 공식 URP GlobalSettings 소스](https://raw.githubusercontent.com/Unity-Technologies/Graphics/6000.0/staging/Packages/com.unity.render-pipelines.universal/Runtime/UniversalRenderPipelineGlobalSettings.cs)
- [Unity C# Reference의 RenderPipelineAsset](https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/6000.0/Runtime/Export/RenderPipeline/RenderPipelineAsset.cs)
- [glTFast 6.20 공식 프로젝트 설정 문서](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.20/manual/ProjectSetup.html)