using UnityEngine;

namespace Raonjena.Adventure
{
    [DefaultExecutionOrder(-100)]
    public sealed class FoundationInputDriver : MonoBehaviour
    {
        public bool Paused { get; private set; }
        public bool ShowDiagnostics { get; private set; }
        private RaonMotor motor;
        private ThirdPersonCameraRig cameraRig;
        private RaonVisual visual;
        private Vector3 previousPointer;
        private bool looking;

        public void Configure(RaonMotor nextMotor, ThirdPersonCameraRig nextCamera, RaonVisual nextVisual)
        {
            motor = nextMotor;
            cameraRig = nextCamera;
            visual = nextVisual;
            motor.enabled = false;
        }

        private void Update()
        {
            if (motor == null || cameraRig == null || visual == null) return;
            if (Input.GetKeyDown(KeyCode.Escape)) SetPaused(!Paused);
            if (Input.GetKeyDown(KeyCode.F3)) ShowDiagnostics = !ShowDiagnostics;
            bool ready = visual.IsReady && !Paused && Application.isFocused;
            motor.enabled = ready;
            cameraRig.enabled = ready;
            if (!ready)
            {
                motor.SetInput(Vector2.zero, false, false);
                looking = false;
                return;
            }

            float horizontal = (Held(KeyCode.D, KeyCode.RightArrow) ? 1f : 0f) - (Held(KeyCode.A, KeyCode.LeftArrow) ? 1f : 0f);
            float vertical = (Held(KeyCode.W, KeyCode.UpArrow) ? 1f : 0f) - (Held(KeyCode.S, KeyCode.DownArrow) ? 1f : 0f);
            motor.SetInput(new Vector2(horizontal, vertical), Held(KeyCode.LeftShift, KeyCode.RightShift), Input.GetKeyDown(KeyCode.Space));
            if (Input.GetKeyDown(KeyCode.R)) ResetPractice();
            if (Input.GetKeyDown(KeyCode.C)) cameraRig.ResetView();

            Vector3 pointer = Input.mousePosition;
            if (Input.GetMouseButton(1))
            {
                if (looking)
                {
                    Vector3 delta = pointer - previousPointer;
                    cameraRig.AddLookDelta(new Vector2(delta.x, delta.y) * 0.17f);
                }
                looking = true;
            }
            else looking = false;
            previousPointer = pointer;
            cameraRig.AddZoom(Input.mouseScrollDelta.y * 0.45f);
        }

        private static bool Held(KeyCode first, KeyCode second) => Input.GetKey(first) || Input.GetKey(second);

        public void SetPaused(bool paused)
        {
            Paused = paused;
            looking = false;
            if (motor != null)
            {
                motor.SetInput(Vector2.zero, false, false);
                motor.enabled = !paused && visual != null && visual.IsReady;
            }
            if (cameraRig != null) cameraRig.enabled = !paused;
            Time.timeScale = paused ? 0f : 1f;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        public void ResetPractice()
        {
            if (motor == null || visual == null || !visual.IsReady) return;
            motor.ResetToSpawn();
            cameraRig.ResetView();
            looking = false;
        }

        private void OnApplicationFocus(bool focused)
        {
            if (!focused) SetPaused(true);
        }

        private void OnDisable()
        {
            if (motor != null) motor.SetInput(Vector2.zero, false, false);
            looking = false;
        }

        private void OnDestroy()
        {
            Time.timeScale = 1f;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }
    }
}
