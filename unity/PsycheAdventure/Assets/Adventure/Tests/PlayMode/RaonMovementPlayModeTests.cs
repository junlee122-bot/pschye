using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace Raonjena.Adventure.Tests
{
    // Requires the real Unity Editor/CharacterController/Physics runtime.
    // Tests are authored here; a source-only review is not a PlayMode pass.
    public sealed class RaonMovementPlayModeTests
    {
        private static readonly Vector3 Origin = new Vector3(1000f, 0f, 1000f);
        private const float Dt = 1f / 60f;
        private GameObject sandbox;
        private GameObject player;
        private Transform view;
        private RaonMotor motor;

        [UnitySetUp]
        public IEnumerator SetUp()
        {
            sandbox = new GameObject("Movement test isolation");
            Box("Floor", new Vector3(0f, -0.5f, 0f), new Vector3(40f, 1f, 40f));
            view = new GameObject("Input camera basis").transform;
            view.SetParent(sandbox.transform);
            player = new GameObject("Raon test controller") { layer = 2 };
            player.transform.SetParent(sandbox.transform);
            player.transform.position = Origin;
            motor = player.AddComponent<RaonMotor>();
            motor.enabled = false; // Manual Tick is the only source of movement.
            motor.Configure(view, Origin);
            Physics.SyncTransforms();
            yield return null;
            Step(3, Vector2.zero);
        }

        [UnityTearDown]
        public IEnumerator TearDown()
        {
            Object.Destroy(sandbox);
            yield return null;
        }

        private GameObject Box(string name, Vector3 offset, Vector3 size)
        {
            var box = GameObject.CreatePrimitive(PrimitiveType.Cube);
            box.name = name;
            box.transform.SetParent(sandbox.transform);
            box.transform.position = Origin + offset;
            box.transform.localScale = size;
            return box;
        }

        private void Step(int count, Vector2 move, bool sprint = false)
        {
            for (var index = 0; index < count; index++)
            {
                motor.SetInput(move, sprint, false);
                motor.Tick(Dt);
            }
        }

        [UnityTest]
        public IEnumerator CameraRelativeWalkSprintAndDiagonalHaveBoundedSpeed()
        {
            Assert.That(motor.Grounded, Is.True);
            view.rotation = Quaternion.Euler(40f, 90f, 0f);
            Step(60, Vector2.up);
            Assert.That(player.transform.position.x - Origin.x, Is.GreaterThan(2f));
            Assert.That(Mathf.Abs(player.transform.position.z - Origin.z), Is.LessThan(0.1f));
            Assert.That(motor.CurrentSpeed, Is.EqualTo(motor.WalkSpeed).Within(0.05f));
            Assert.That(Vector3.Angle(player.transform.forward, Vector3.right), Is.LessThan(1f));
            Step(60, Vector2.one, true);
            Assert.That(motor.CurrentSpeed, Is.EqualTo(motor.SprintSpeed).Within(0.05f));
            Assert.That(Mathf.Abs(player.transform.position.y - Origin.y), Is.LessThan(0.1f));
            Step(30, Vector2.zero);
            Assert.That(motor.CurrentSpeed, Is.LessThan(0.01f));
            yield return null;
        }

        [UnityTest]
        public IEnumerator WallStopsMovementAndReportsActualSpeed()
        {
            Box("Wall", new Vector3(0f, 1f, 1.2f), new Vector3(4f, 2f, 0.5f));
            Physics.SyncTransforms();
            Step(90, Vector2.up, true);
            Assert.That(player.transform.position.z - Origin.z, Is.LessThan(0.9f));
            Assert.That(motor.CurrentSpeed, Is.LessThan(0.05f));
            Assert.That(motor.Grounded, Is.True);
            yield return null;
        }

        [UnityTest]
        public IEnumerator JumpLandsAndAirborneRepeatedRequestsCannotDoubleJump()
        {
            motor.SetInput(Vector2.zero, false, true);
            motor.Tick(Dt);
            Assert.That(motor.VerticalSpeed, Is.GreaterThan(0f));
            Assert.That(motor.Grounded, Is.False);
            var peak = player.transform.position.y;
            var landed = false;
            for (var index = 0; index < 150; index++)
            {
                var previous = motor.VerticalSpeed;
                motor.SetInput(Vector2.zero, false, true);
                motor.Tick(Dt);
                peak = Mathf.Max(peak, player.transform.position.y);
                if (motor.Grounded) { landed = true; break; }
                Assert.That(motor.VerticalSpeed, Is.LessThanOrEqualTo(previous + 0.001f));
            }
            Assert.That(peak - Origin.y, Is.InRange(0.7f, 1.5f));
            Assert.That(landed, Is.True);
            Assert.That(Mathf.Abs(player.transform.position.y - Origin.y), Is.LessThan(0.1f));
            yield return null;
        }

        [UnityTest]
        public IEnumerator CeilingStopsUpwardMotion()
        {
            Box("Low ceiling", new Vector3(0f, 2.3f, 0f), new Vector3(4f, 0.2f, 4f));
            Physics.SyncTransforms();
            motor.SetInput(Vector2.zero, false, true);
            motor.Tick(Dt);
            var peak = player.transform.position.y;
            for (var index = 0; index < 120; index++)
            {
                Step(1, Vector2.zero);
                peak = Mathf.Max(peak, player.transform.position.y);
            }
            Assert.That(peak - Origin.y, Is.LessThan(0.55f));
            Assert.That(motor.Grounded, Is.True);
            yield return null;
        }

        [UnityTest]
        public IEnumerator ControllerClimbsLowStepAndReturnsToGround()
        {
            Box("20cm step", new Vector3(0f, 0.1f, 1.25f), new Vector3(3f, 0.2f, 1f));
            Physics.SyncTransforms();
            var peak = player.transform.position.y;
            for (var index = 0; index < 100; index++)
            {
                Step(1, Vector2.up);
                peak = Mathf.Max(peak, player.transform.position.y);
            }
            Assert.That(peak - Origin.y, Is.GreaterThan(0.15f));
            Assert.That(player.transform.position.z - Origin.z, Is.GreaterThan(2.5f));
            Assert.That(motor.Grounded, Is.True);
            yield return null;
        }

        [UnityTest]
        public IEnumerator WalkableSlopeCanBeAscended()
        {
            var ramp = Box("25 degree ramp", new Vector3(0f, 0.8f, 2.5f), new Vector3(3f, 0.2f, 4f));
            ramp.transform.rotation = Quaternion.Euler(-25f, 0f, 0f);
            Physics.SyncTransforms();
            var peak = player.transform.position.y;
            for (var index = 0; index < 100; index++)
            {
                Step(1, Vector2.up);
                peak = Mathf.Max(peak, player.transform.position.y);
            }
            Assert.That(peak - Origin.y, Is.GreaterThan(0.7f));
            yield return null;
        }

        [UnityTest]
        public IEnumerator SlopeAboveControllerLimitCannotBeWalkedUp()
        {
            var ramp = Box("65 degree ramp", new Vector3(0f, 1.8f, 2.5f), new Vector3(3f, 0.2f, 4f));
            ramp.transform.rotation = Quaternion.Euler(-65f, 0f, 0f);
            Physics.SyncTransforms();
            Step(150, Vector2.up);
            Assert.That(player.transform.position.y - Origin.y, Is.LessThan(0.8f));
            Assert.That(player.transform.position.z - Origin.z, Is.LessThan(2.2f));
            yield return null;
        }

        [UnityTest]
        public IEnumerator FallingOffWorldRespawnsWithoutRetainingInputOrVelocity()
        {
            var controller = player.GetComponent<CharacterController>();
            controller.enabled = false;
            player.transform.position = Origin + Vector3.forward * 50f;
            controller.enabled = true;
            Physics.SyncTransforms();
            var sawFalling = false;
            for (var index = 0; index < 240; index++)
            {
                motor.Tick(Dt);
                sawFalling |= motor.VerticalSpeed < -5f;
            }
            Assert.That(sawFalling, Is.True);
            Assert.That(Vector3.Distance(player.transform.position, Origin), Is.LessThan(0.1f));
            motor.SetInput(Vector2.one, true, true);
            motor.ResetToSpawn();
            motor.Tick(Dt);
            Assert.That(motor.CurrentSpeed, Is.Zero);
            Assert.That(motor.VerticalSpeed, Is.LessThanOrEqualTo(0f));
            Assert.That(motor.Grounded, Is.True);
            yield return null;
        }

        [UnityTest]
        public IEnumerator InvalidInputsAndTimeDoNotCorruptWorldPosition()
        {
            var before = player.transform.position;
            motor.SetInput(new Vector2(float.NaN, 1f), true, false);
            motor.Tick(float.PositiveInfinity);
            motor.Tick(-1f);
            Assert.That(player.transform.position, Is.EqualTo(before));
            Step(10, new Vector2(float.NaN, 1f));
            Assert.That(MovementMath.IsFinite(player.transform.position), Is.True);
            Assert.That(motor.CurrentSpeed, Is.Zero);
            yield return null;
        }
    }
}
