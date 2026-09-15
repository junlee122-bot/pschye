using NUnit.Framework;

namespace Raonjena.Adventure.Tests
{
    public sealed class RaonVisualTests
    {
        [TestCase(0f, true, -2f, "idle")]
        [TestCase(2.6f, true, -2f, "walk")]
        [TestCase(5.4f, true, -2f, "run")]
        [TestCase(0f, false, 5f, "jump")]
        [TestCase(5.4f, false, -3f, "jump")]
        public void CurrentCandidateSelectsExistingClip(float speed, bool grounded, float vertical, string expected)
        {
            Assert.That(RaonVisual.ChooseLocomotionClip(speed, grounded, vertical, 2.6f, true, false), Is.EqualTo(expected));
        }

        [Test]
        public void BlockedRunningActorUsesIdleFromActualSpeed()
        {
            Assert.That(RaonVisual.ChooseLocomotionClip(0f, true, -2f, 2.6f, true, false), Is.EqualTo("idle"));
        }

        [TestCase(false, false, 4f, "idle")]
        [TestCase(false, true, 4f, "fall")]
        [TestCase(true, true, -4f, "fall")]
        [TestCase(true, true, 4f, "jump")]
        public void MissingAirClipsHaveExplicitFallback(bool jump, bool fall, float vertical, string expected)
        {
            Assert.That(RaonVisual.ChooseLocomotionClip(2f, false, vertical, 2.6f, jump, fall), Is.EqualTo(expected));
        }

        [TestCase("https://example.test/StreamingAssets", "https://example.test/StreamingAssets/Raon/raon-unity-runtime.glb")]
        [TestCase("jar:file:///app/base.apk!/assets", "jar:file:///app/base.apk!/assets/Raon/raon-unity-runtime.glb")]
        public void ExistingStreamingAssetUrlRetainsItsScheme(string input, string expected)
        {
            Assert.That(RaonVisual.StreamingAssetUri(input), Is.EqualTo(expected));
        }

        [Test]
        public void DesktopStreamingAssetPathEscapesSpacesAndKorean()
        {
            var result = RaonVisual.StreamingAssetUri("C:/Games/라온 모험/StreamingAssets");
            Assert.That(result, Does.StartWith("file:///C:/Games/"));
            Assert.That(result, Does.Not.Contain(" "));
            Assert.That(result, Does.EndWith("/StreamingAssets/Raon/raon-unity-runtime.glb"));
        }
    }
}
