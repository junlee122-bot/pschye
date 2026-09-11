using System;
using System.Collections.Generic;
using UnityEngine;

namespace Raonjena.Validation
{
    [ExecuteAlways]
    public sealed class RaonDeformationStressTest : MonoBehaviour
    {
        [SerializeField] private AnimationClip[] clips = Array.Empty<AnimationClip>();
        [SerializeField, Min(0.25f)] private float secondsPerClip = 2f;
        [SerializeField] private bool cycleExpressions = true;

        private SkinnedMeshRenderer[] renderers = Array.Empty<SkinnedMeshRenderer>();
        private Transform[] transforms = Array.Empty<Transform>();
        private readonly List<string> failures = new();
        private float elapsed;
        private int clipIndex;

        private void OnEnable()
        {
            renderers = GetComponentsInChildren<SkinnedMeshRenderer>(true);
            transforms = GetComponentsInChildren<Transform>(true);
            elapsed = 0f;
            clipIndex = 0;
        }

        private void Update()
        {
            if (clips.Length == 0) return;
            elapsed += Application.isPlaying ? Time.deltaTime : 1f / 60f;
            var clip = clips[Mathf.Clamp(clipIndex, 0, clips.Length - 1)];
            var normalized = Mathf.Repeat(elapsed / secondsPerClip, 1f);
            clip.SampleAnimation(gameObject, normalized * clip.length);
            if (cycleExpressions) SampleExpressions(normalized);
            ValidatePose(clip.name, normalized);
            if (elapsed >= secondsPerClip)
            {
                elapsed = 0f;
                clipIndex = (clipIndex + 1) % clips.Length;
            }
        }

        private void SampleExpressions(float normalized)
        {
            foreach (var renderer in renderers)
            {
                var shapeCount = renderer.sharedMesh != null ? renderer.sharedMesh.blendShapeCount : 0;
                if (shapeCount == 0) continue;
                for (var index = 0; index < shapeCount; index++) renderer.SetBlendShapeWeight(index, 0f);
                var active = Mathf.FloorToInt(normalized * shapeCount) % shapeCount;
                renderer.SetBlendShapeWeight(active, 100f);
            }
        }

        private void ValidatePose(string clipName, float normalized)
        {
            failures.Clear();
            foreach (var transformToCheck in transforms)
            {
                if (!Finite(transformToCheck.position) || !Finite(transformToCheck.localScale)) failures.Add($"Non-finite transform: {transformToCheck.name}");
            }
            foreach (var renderer in renderers)
            {
                if (!Finite(renderer.bounds.center) || !Finite(renderer.bounds.extents)) failures.Add($"Non-finite bounds: {renderer.name}");
                if (renderer.bounds.size.magnitude > 5f) failures.Add($"Exploded bounds: {renderer.name} {renderer.bounds.size}");
            }
            if (failures.Count > 0) Debug.LogError($"Raon deformation stress failure in {clipName}@{normalized:F2}\n{string.Join("\n", failures)}", this);
        }

        private static bool Finite(Vector3 value)
        {
            return float.IsFinite(value.x) && float.IsFinite(value.y) && float.IsFinite(value.z);
        }
    }
}
