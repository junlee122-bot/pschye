using UnityEngine;

namespace Raonjena.Adventure
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(Camera))]
    public sealed class ThirdPersonCameraRig : MonoBehaviour
    {
        [SerializeField] private Vector3 pivotOffset = new Vector3(0f, 1.35f, 0f);
        [SerializeField, Min(0.01f)] private float collisionRadius = 0.22f;
        [SerializeField, Min(0f)] private float collisionPadding = 0.06f;
        [SerializeField, Min(0.1f)] private float followSharpness = 18f;
        [SerializeField, Min(0.1f)] private float returnSharpness = 8f;
        [SerializeField] private LayerMask collisionMask = Physics.DefaultRaycastLayers;
        private const float InitialPitch = 18f;
        private const float InitialDistance = 4.8f;
        private const float MinimumDistance = 1.2f;
        private const float MaximumDistance = 7f;
        private Transform target;
        private Vector3 pivot;
        private float desiredDistance = InitialDistance;

        public float Yaw { get; private set; }
        public float Pitch { get; private set; } = InitialPitch;
        public float CurrentDistance { get; private set; } = InitialDistance;
        public float DesiredDistance => desiredDistance;
        public bool Obstructed { get; private set; }

        public void Configure(Transform followTarget)
        {
            target = followTarget;
            ResetView();
        }

        /// <summary>Degrees. Positive x looks right; positive y looks upward.</summary>
        public void AddLookDelta(Vector2 degrees)
        {
            if (!MovementMath.IsFinite(degrees)) return;
            Yaw = Mathf.Repeat(Yaw + Mathf.Clamp(degrees.x, -360f, 360f), 360f);
            Pitch = Mathf.Clamp(Pitch - Mathf.Clamp(degrees.y, -180f, 180f), -30f, 70f);
        }

        /// <summary>Positive metres zoom closer. Collision can bring the camera below the user zoom minimum.</summary>
        public void AddZoom(float metres)
        {
            if (!MovementMath.IsFinite(metres)) return;
            desiredDistance = Mathf.Clamp(desiredDistance - metres, MinimumDistance, MaximumDistance);
        }

        public void ResetView()
        {
            Yaw = 0f;
            Pitch = InitialPitch;
            desiredDistance = InitialDistance;
            CurrentDistance = InitialDistance;
            Obstructed = false;
            if (target == null || !MovementMath.IsFinite(target.position)) return;
            pivot = target.position + pivotOffset;
            PlaceCamera(0f, true);
        }

        private void LateUpdate() => Tick(Time.deltaTime);

        public void Tick(float deltaTime)
        {
            var dt = MovementMath.DeltaTime(deltaTime);
            if (target == null || !MovementMath.IsFinite(target.position) || dt <= 0f) return;
            var nextPivot = target.position + pivotOffset;
            // A respawn/teleport must not sweep the camera across the intervening world.
            pivot = (nextPivot - pivot).sqrMagnitude > 100f
                ? nextPivot
                : Vector3.Lerp(pivot, nextPivot, MovementMath.DampFactor(followSharpness, dt));
            PlaceCamera(dt, false);
        }

        private void PlaceCamera(float dt, bool immediate)
        {
            var rotation = Quaternion.Euler(Pitch, Yaw, 0f);
            var direction = -(rotation * Vector3.forward);
            var mask = collisionMask.value & ~(1 << target.gameObject.layer);
            var allowedDistance = desiredDistance;
            // SphereCast does not report an obstacle already overlapping its start.
            // A smoothed pivot can cross a corner even while the player stays clear.
            if (Physics.CheckSphere(pivot, collisionRadius, mask, QueryTriggerInteraction.Ignore))
                pivot = target.position + pivotOffset;
            if (Physics.CheckSphere(pivot, collisionRadius, mask, QueryTriggerInteraction.Ignore))
            {
                Obstructed = true;
                CurrentDistance = 0.05f;
                transform.SetPositionAndRotation(pivot + direction * CurrentDistance, rotation);
                return;
            }
            Obstructed = Physics.SphereCast(pivot, collisionRadius, direction, out var hit,
                desiredDistance, mask, QueryTriggerInteraction.Ignore);
            if (Obstructed) allowedDistance = Mathf.Max(0.05f, hit.distance - collisionPadding);
            // Contract toward a wall immediately; only ease outward after it clears.
            CurrentDistance = immediate || allowedDistance < CurrentDistance
                ? allowedDistance
                : Mathf.Lerp(CurrentDistance, allowedDistance, MovementMath.DampFactor(returnSharpness, dt));
            transform.SetPositionAndRotation(pivot + direction * CurrentDistance, rotation);
        }
    }
}
