using UnityEngine;

namespace Raonjena.Adventure
{
    /// <summary>Input and time rules shared by the motor, camera and Editor tests.</summary>
    public static class MovementMath
    {
        public const float MaximumDeltaTime = 0.1f;

        public static bool IsFinite(float value) => !float.IsNaN(value) && !float.IsInfinity(value);
        public static bool IsFinite(Vector2 value) => IsFinite(value.x) && IsFinite(value.y);
        public static bool IsFinite(Vector3 value) => IsFinite(value.x) && IsFinite(value.y) && IsFinite(value.z);

        public static float DeltaTime(float value)
        {
            return IsFinite(value) && value > 0f ? Mathf.Min(value, MaximumDeltaTime) : 0f;
        }

        public static Vector2 ClampInput(Vector2 input)
        {
            if (!IsFinite(input)) return Vector2.zero;
            // Bound components before magnitude calculation to avoid overflow.
            return Vector2.ClampMagnitude(new Vector2(Mathf.Clamp(input.x, -1f, 1f), Mathf.Clamp(input.y, -1f, 1f)), 1f);
        }

        public static Vector3 CameraRelative(Vector2 input, Vector3 cameraForward, Vector3 cameraRight)
        {
            input = ClampInput(input);
            var forward = IsFinite(cameraForward) ? Vector3.ProjectOnPlane(cameraForward, Vector3.up) : Vector3.zero;
            if (forward.sqrMagnitude < 0.0001f)
            {
                var right = IsFinite(cameraRight) ? Vector3.ProjectOnPlane(cameraRight, Vector3.up) : Vector3.right;
                forward = right.sqrMagnitude > 0.0001f ? Vector3.Cross(right.normalized, Vector3.up) : Vector3.forward;
            }
            forward.Normalize();
            var planarRight = Vector3.Cross(Vector3.up, forward);
            return planarRight * input.x + forward * input.y;
        }

        public static float JumpSpeed(float height, float gravity)
        {
            if (!IsFinite(height) || !IsFinite(gravity) || height <= 0f || gravity <= 0f) return 0f;
            return Mathf.Sqrt(2f * Mathf.Min(height, 10f) * Mathf.Min(gravity, 100f));
        }

        public static float DampFactor(float sharpness, float deltaTime)
        {
            return 1f - Mathf.Exp(-Mathf.Max(0f, sharpness) * DeltaTime(deltaTime));
        }
    }
}
