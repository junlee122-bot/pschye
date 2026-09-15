using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace Raonjena.Adventure.Tests
{
    public sealed class ThirdPersonCameraPlayModeTests
    {
        private static readonly Vector3 Origin = new Vector3(1100f, 0f, 1100f);
        private GameObject sandbox;
        private Transform target;
        private ThirdPersonCameraRig rig;

        [UnitySetUp]
        public IEnumerator SetUp()
        {
            sandbox = new GameObject("Camera test isolation");
            var player = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            player.layer = 2;
            player.transform.SetParent(sandbox.transform);
            player.transform.position = Origin;
            target = player.transform;
            var camera = new GameObject("Test camera");
            camera.transform.SetParent(sandbox.transform);
            rig = camera.AddComponent<ThirdPersonCameraRig>();
            rig.enabled = false;
            camera.GetComponent<Camera>().enabled = false;
            rig.Configure(target);
            Physics.SyncTransforms();
            yield return null;
        }

        [UnityTearDown]
        public IEnumerator TearDown()
        {
            Object.Destroy(sandbox);
            yield return null;
        }

        [UnityTest]
        public IEnumerator DefaultViewExcludesPlayerAndLookZoomAreBounded()
        {
            rig.Tick(1f / 60f);
            Assert.That(rig.Obstructed, Is.False);
            Assert.That(rig.Yaw, Is.Zero);
            Assert.That(rig.Pitch, Is.EqualTo(18f));
            Assert.That(rig.CurrentDistance, Is.EqualTo(4.8f).Within(0.001f));
            Assert.That(rig.transform.forward.z, Is.GreaterThan(0.9f));
            rig.AddLookDelta(new Vector2(90f, 1000f));
            rig.AddZoom(100f);
            rig.Tick(1f / 60f);
            Assert.That(rig.Yaw, Is.EqualTo(90f));
            Assert.That(rig.Pitch, Is.EqualTo(-30f));
            Assert.That(rig.DesiredDistance, Is.EqualTo(1.2f));
            rig.AddZoom(-100f);
            Assert.That(rig.DesiredDistance, Is.EqualTo(7f));
            rig.AddLookDelta(new Vector2(float.NaN, 0f));
            rig.AddZoom(float.PositiveInfinity);
            Assert.That(rig.Yaw, Is.EqualTo(90f));
            Assert.That(rig.DesiredDistance, Is.EqualTo(7f));
            rig.ResetView();
            Assert.That(rig.Yaw, Is.Zero);
            Assert.That(rig.Pitch, Is.EqualTo(18f));
            Assert.That(rig.CurrentDistance, Is.EqualTo(4.8f).Within(0.001f));
            yield return null;
        }

        [UnityTest]
        public IEnumerator WallContractsCameraImmediatelyAndClearanceRestoresDistance()
        {
            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.transform.SetParent(sandbox.transform);
            wall.transform.position = Origin + new Vector3(0f, 2f, -2f);
            wall.transform.localScale = new Vector3(4f, 4f, 0.25f);
            Physics.SyncTransforms();
            rig.Tick(1f / 60f);
            Assert.That(rig.Obstructed, Is.True);
            Assert.That(rig.CurrentDistance, Is.LessThan(2f));
            Assert.That(Physics.CheckSphere(rig.transform.position, 0.2f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore), Is.False);
            Object.Destroy(wall);
            yield return null;
            Physics.SyncTransforms();
            for (var frame = 0; frame < 150; frame++) rig.Tick(1f / 60f);
            Assert.That(rig.Obstructed, Is.False);
            Assert.That(rig.CurrentDistance, Is.EqualTo(4.8f).Within(0.001f));
        }

        [UnityTest]
        public IEnumerator TeleportAndInvalidTimeCannotLeaveAnUnboundedCameraTrail()
        {
            var before = rig.transform.position;
            rig.Tick(float.NaN);
            rig.Tick(-1f);
            Assert.That(rig.transform.position, Is.EqualTo(before));
            target.position = Origin + Vector3.right * 30f;
            rig.Tick(1f / 60f);
            Assert.That(Vector3.Distance(rig.transform.position, target.position), Is.LessThan(6f));
            Assert.That(MovementMath.IsFinite(rig.transform.position), Is.True);
            yield return null;
        }

        [UnityTest]
        public IEnumerator FollowPivotCannotSmoothThroughAnObstacleAndCastFromInsideIt()
        {
            var corner = GameObject.CreatePrimitive(PrimitiveType.Cube);
            corner.transform.SetParent(sandbox.transform);
            corner.transform.position = Origin + new Vector3(0.7f, 1.35f, 0f);
            corner.transform.localScale = new Vector3(1f, 2f, 0.5f);
            target.position = Origin + Vector3.right * 3f;
            Physics.SyncTransforms();
            rig.Tick(1f / 60f);
            Assert.That(rig.transform.position.x, Is.EqualTo(target.position.x).Within(0.01f));
            Assert.That(Physics.CheckSphere(rig.transform.position, 0.2f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore), Is.False);
            yield return null;
        }
    }
}
