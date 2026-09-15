using UnityEngine;

namespace Raonjena.Adventure
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(CharacterController))]
    [DefaultExecutionOrder(50)]
    public sealed class RaonMotor : MonoBehaviour
    {
        [Header("Locomotion (metres / seconds)")]
        [SerializeField, Min(0.1f)] private float walkSpeed = 2.6f;
        [SerializeField, Min(0.1f)] private float sprintSpeed = 5.4f;
        [SerializeField, Min(0.1f)] private float acceleration = 18f;
        [SerializeField, Min(0.1f)] private float braking = 24f;
        [SerializeField, Min(1f)] private float turnSpeed = 540f;
        [SerializeField, Min(0.1f)] private float jumpHeight = 1.2f;
        [SerializeField, Min(0.1f)] private float gravity = 20f;
        [SerializeField, Min(1f)] private float terminalSpeed = 38f;
        [SerializeField, Min(2f)] private float respawnDrop = 25f;
        [SerializeField] private LayerMask groundMask = Physics.DefaultRaycastLayers;

        private const float GroundStickSpeed = -2f;
        private const float GroundProbeDistance = 0.12f;
        private CharacterController controller;
        private Transform view;
        private Vector3 spawn;
        private Vector3 planarVelocity;
        private Vector2 moveInput;
        private bool sprint;
        private bool jumpRequested;

        public float CurrentSpeed { get; private set; }
        public bool Grounded { get; private set; }
        public float VerticalSpeed { get; private set; }
        public float WalkSpeed => walkSpeed;
        public float SprintSpeed => sprintSpeed;
        public Vector3 SpawnPosition => spawn;
        public Vector3 PlanarVelocity => planarVelocity;

        private void Awake()
        {
            controller = GetComponent<CharacterController>();
            controller.height = 1.8f;
            controller.radius = 0.3f;
            controller.center = new Vector3(0f, 0.9f, 0f);
            controller.skinWidth = 0.035f;
            controller.stepOffset = 0.3f;
            controller.slopeLimit = 45f;
            controller.minMoveDistance = 0f;
            spawn = MovementMath.IsFinite(transform.position) ? transform.position : Vector3.zero;
        }

        public void Configure(Transform camera, Vector3 spawnPosition)
        {
            view = camera;
            spawn = MovementMath.IsFinite(spawnPosition) ? spawnPosition : Vector3.zero;
            ResetToSpawn();
        }

        /// <summary>jumpPressed is an edge for this input sample, not a held button.</summary>
        public void SetInput(Vector2 move, bool isSprinting, bool jumpPressed)
        {
            moveInput = MovementMath.ClampInput(move);
            sprint = isSprinting;
            jumpRequested = jumpPressed;
        }

        private void Update() => Tick(Time.deltaTime);

        private void OnDisable()
        {
            SetInput(Vector2.zero, false, false);
            planarVelocity = Vector3.zero;
            CurrentSpeed = 0f;
        }

        /// <summary>Can be stepped by PlayMode tests while this behaviour's Update is disabled.</summary>
        public void Tick(float deltaTime)
        {
            var dt = MovementMath.DeltaTime(deltaTime);
            if (controller == null) controller = GetComponent<CharacterController>();
            if (controller == null || !controller.enabled || !gameObject.activeInHierarchy || dt <= 0f) return;
            if (!MovementMath.IsFinite(transform.position) || transform.position.y < spawn.y - respawnDrop || (transform.position - spawn).sqrMagnitude > 100000000f)
            {
                ResetToSpawn();
                return;
            }

            Grounded = VerticalSpeed <= 0f && ProbeGround();
            if (Grounded) VerticalSpeed = GroundStickSpeed;
            if (jumpRequested && Grounded)
            {
                VerticalSpeed = MovementMath.JumpSpeed(jumpHeight, gravity);
                Grounded = false;
            }
            jumpRequested = false;

            var forward = view != null ? view.forward : Vector3.forward;
            var right = view != null ? view.right : Vector3.right;
            var direction = MovementMath.CameraRelative(moveInput, forward, right);
            var desiredVelocity = direction * (sprint ? sprintSpeed : walkSpeed);
            planarVelocity = Vector3.MoveTowards(planarVelocity, desiredVelocity, (direction.sqrMagnitude > 0f ? acceleration : braking) * dt);
            if (direction.sqrMagnitude > 0.0001f)
            {
                var desiredRotation = Quaternion.LookRotation(direction, Vector3.up);
                transform.rotation = Quaternion.RotateTowards(transform.rotation, desiredRotation, turnSpeed * dt);
            }

            VerticalSpeed = Mathf.Max(-terminalSpeed, VerticalSpeed - gravity * dt);
            var before = transform.position;
            var flags = controller.Move((planarVelocity + Vector3.up * VerticalSpeed) * dt);
            CurrentSpeed = Vector3.ProjectOnPlane(transform.position - before, Vector3.up).magnitude / dt;
            if ((flags & CollisionFlags.Above) != 0 && VerticalSpeed > 0f) VerticalSpeed = 0f;
            Grounded = VerticalSpeed <= 0f && ProbeGround();
            if (Grounded) VerticalSpeed = GroundStickSpeed;
            if (transform.position.y < spawn.y - respawnDrop) ResetToSpawn();
        }

        private bool ProbeGround()
        {
            var scale = transform.lossyScale;
            var radius = controller.radius * Mathf.Max(Mathf.Abs(scale.x), Mathf.Abs(scale.z));
            var height = Mathf.Max(controller.height * Mathf.Abs(scale.y), radius * 2f);
            var center = transform.TransformPoint(controller.center);
            var bottom = center - Vector3.up * (height * 0.5f - radius);
            var mask = groundMask.value & ~(1 << gameObject.layer);
            if (!Physics.SphereCast(bottom + Vector3.up * GroundProbeDistance, Mathf.Max(0.01f, radius - controller.skinWidth), Vector3.down,
                out var hit, GroundProbeDistance + controller.skinWidth + 0.05f, mask, QueryTriggerInteraction.Ignore)) return false;
            return Vector3.Angle(hit.normal, Vector3.up) <= controller.slopeLimit + 0.5f;
        }

        public void ResetToSpawn()
        {
            if (controller == null) controller = GetComponent<CharacterController>();
            var wasEnabled = controller != null && controller.enabled;
            if (wasEnabled) controller.enabled = false;
            transform.SetPositionAndRotation(spawn, Quaternion.identity);
            if (wasEnabled) controller.enabled = true;
            Physics.SyncTransforms();
            SetInput(Vector2.zero, false, false);
            planarVelocity = Vector3.zero;
            CurrentSpeed = 0f;
            VerticalSpeed = 0f;
            Grounded = wasEnabled && ProbeGround();
        }
    }
}
