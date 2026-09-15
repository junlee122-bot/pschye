using NUnit.Framework;
using UnityEngine;

namespace Raonjena.Adventure.Tests
{
    public sealed class MovementMathTests
    {
        [Test]
        public void DiagonalInputDoesNotExceedCardinalSpeed()
        {
            Assert.That(MovementMath.ClampInput(Vector2.one).magnitude, Is.EqualTo(1f).Within(0.00001f));
            Assert.That(MovementMath.ClampInput(new Vector2(0.2f, 0.3f)), Is.EqualTo(new Vector2(0.2f, 0.3f)));
            Assert.That(MovementMath.ClampInput(new Vector2(float.MaxValue, float.MaxValue)).magnitude, Is.EqualTo(1f).Within(0.00001f));
        }

        [TestCase(float.NaN)]
        [TestCase(float.PositiveInfinity)]
        [TestCase(float.NegativeInfinity)]
        public void NonFiniteInputAndTimeAreRejected(float invalid)
        {
            Assert.That(MovementMath.ClampInput(new Vector2(invalid, 1f)), Is.EqualTo(Vector2.zero));
            Assert.That(MovementMath.DeltaTime(invalid), Is.Zero);
            Assert.That(MovementMath.JumpSpeed(invalid, 20f), Is.Zero);
        }

        [Test]
        public void CameraYawChangesForwardWithoutAddingVerticalMovement()
        {
            var camera = Quaternion.Euler(65f, 90f, 0f);
            var result = MovementMath.CameraRelative(Vector2.up, camera * Vector3.forward, camera * Vector3.right);
            Assert.That(Vector3.Distance(result, Vector3.right), Is.LessThan(0.00001f));
        }

        [Test]
        public void VerticalOrMissingCameraDirectionHasStableFallback()
        {
            Assert.That(MovementMath.CameraRelative(Vector2.up, Vector3.down, Vector3.right), Is.EqualTo(Vector3.forward));
            Assert.That(MovementMath.CameraRelative(Vector2.right, Vector3.zero, Vector3.zero), Is.EqualTo(Vector3.right));
            var invalid = new Vector3(float.NaN, 0f, 0f);
            Assert.That(MovementMath.CameraRelative(Vector2.up, invalid, invalid), Is.EqualTo(Vector3.forward));
        }

        [Test]
        public void TimeCannotRunBackwardsOrAdvanceAnUnboundedFrame()
        {
            Assert.That(MovementMath.DeltaTime(0f), Is.Zero);
            Assert.That(MovementMath.DeltaTime(-1f), Is.Zero);
            Assert.That(MovementMath.DeltaTime(40f), Is.EqualTo(MovementMath.MaximumDeltaTime));
            Assert.That(MovementMath.DeltaTime(1f / 60f), Is.EqualTo(1f / 60f));
        }

        [Test]
        public void JumpSpeedCorrespondsToConfiguredHeightUnderGravity()
        {
            var speed = MovementMath.JumpSpeed(1.2f, 20f);
            Assert.That(speed * speed / 40f, Is.EqualTo(1.2f).Within(0.00001f));
            Assert.That(MovementMath.JumpSpeed(1f, 0f), Is.Zero);
            Assert.That(MovementMath.JumpSpeed(-1f, 20f), Is.Zero);
        }
    }
}
