# 9묶음 이동·카메라 코어 인계

2026-09-15. 새 `unity/PsycheAdventure` 안에 작성했으며 기존 웹/Unity 검수 프로젝트는 수정하지 않았다. Unity Editor 설치를 찾지 못하여 C# 컴파일, PlayMode, 실제 조작 통과 결과는 없다.

## 소유 변경

- `Assets/Adventure/Runtime/MovementMath.cs`: 유한 입력·dt 상한 0.1초, 대각선 속도 제한, 카메라의 평면 방향, 점프 초기 속도, 감쇠 계수.
- `Assets/Adventure/Runtime/RaonMotor.cs`: CharacterController, 카메라 상대 걷기 2.6m/s·달리기 5.4m/s, 가속/감속·회전, 높이1.2m 점프·중력20, 천장 충돌 시 상승 중단, 접지검사, 기본 capsule 높이1.8/radius0.3/step0.3/slope45. spawn보다25m 아래로 떨어지거나 비정상 위치이면 controller를 잠깐 꺼 안전하게 지정 spawn으로 재배치하고 입력·속도를 비운다. spawn 마커가 지형 밖/장애물 안에 놓이지 않는 것은 씬 구성의 책임이다.
- `Assets/Adventure/Runtime/ThirdPersonCameraRig.cs`: yaw0/pitch18/distance4.8, 상하각·거리 제한, 플레이어 layer 제외 SphereCast, 벽에서 즉시 당겨지고 열린 공간에서 서서히 복귀. smoothed pivot이 모서리 안으로 들어가면 actual target pivot으로 옮겨 초기 겹침 누락을 막는다.
- `Assets/Adventure/Tests/EditMode/MovementMathTests.cs`: 8 NUnit 사례.
- `Assets/Adventure/Tests/PlayMode/RaonMovementPlayModeTests.cs`: 9 UnityTest 행동 사례.
- `Assets/Adventure/Tests/PlayMode/ThirdPersonCameraPlayModeTests.cs`: 4 UnityTest 행동 사례.
- 두 Tests asmdef는 루트 소유 `Raonjena.Adventure.Runtime`을 참조한다. 총21개는 **작성한 사례 수**이며 실행/통과 수가 아니다. 별도 Visual 검사는 다른 담당자의 소유다.

## 공개 계약

namespace는 `Raonjena.Adventure`다. Motor는 입력 장치를 읽지 않고 `SetInput(Vector2, bool sprint, bool jumpPressed)`를 받는다. jumpPressed는 해당 입력 sample의 edge이며 한 Tick에서 소비되고, false sample이 오면 대기 요청도 비워진다. `Configure(Transform camera, Vector3 spawn)`, `Tick(float dt)`, `ResetToSpawn()`을 제공한다. 자동 Update 순서는50이고 컴포넌트가 disabled여도 테스트는 Tick을 직접 호출할 수 있다. CurrentSpeed는 명령 속도가 아니라 실제 평면 이동량/초이며 벽에 막히면0이다. Grounded, VerticalSpeed, WalkSpeed, SprintSpeed, SpawnPosition, PlanarVelocity를 관측할 수 있다.

CameraRig는 Camera GameObject에 붙이며 `Configure(Transform target)`, `AddLookDelta(Vector2 degrees)`, `AddZoom(float metres)`, `ResetView()`, `Tick(float dt)`를 제공한다. 양수look.x는오른쪽, 양수look.y는위쪽; 양수zoom은가까워지는거리다. 자동실행은LateUpdate이고 Yaw/Pitch/CurrentDistance/DesiredDistance/Obstructed가 공개된다. player layer2 및 기본mask를 사용하며 nearClip0.1은 루트 Bootstrap에서 설정한다.

## 작성한 행동 검사의 경계

PlayMode는 실제 Physics/CharacterController로 평지·벽·낮은 턱·25도/65도 경사·점프·공중 재점프 거부·천장·낙하/리셋·비정상 입력·카메라 충돌/복귀·순간이동·평활 pivot 모서리 겹침을 검사하도록 작성했다. 자동 Update를 끄고 같은 Tick API로 실행한다. Editor가 없는 상태에서 이 파일을 읽거나 JSON asmdef를 파싱하는 것은 행동 검사 통과가 아니다. 실제 임포트 후 지형/물리 수치 허용오차와 모션 시각 검수를 수행해야 한다.

Unity 6 공식 API를 확인했다: [CharacterController.Move](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/CharacterController.Move.html)는 중력을 직접 적용하지 않으므로 별도 수직속도를 적분하고, [Physics.SphereCast](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Physics.SphereCast.html)의 시작 겹침 미검출은 CheckSphere로 분리했다. 기본 controller 설정의 의미는 [Character Controller 문서](https://docs.unity3d.com/6000.0/Documentation/Manual/class-CharacterController.html)를 참조했다.
