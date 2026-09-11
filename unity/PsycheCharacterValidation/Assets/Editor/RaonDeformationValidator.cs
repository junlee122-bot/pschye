using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Raonjena.Validation.Editor
{
    public static class RaonDeformationValidator
    {
        private static readonly string[] RequiredBones =
        {
            "Hips", "Spine", "Chest", "UpperChest", "Neck", "Head",
            "LeftUpperLeg", "LeftLowerLeg", "LeftFoot", "RightUpperLeg", "RightLowerLeg", "RightFoot",
            "LeftShoulder", "LeftUpperArm", "LeftLowerArm", "LeftHand",
            "RightShoulder", "RightUpperArm", "RightLowerArm", "RightHand"
        };

        private static readonly string[] RequiredClips =
        {
            "idle", "walk", "run", "sprint", "jump", "land",
            "dodge", "attackLight", "attackHeavy", "guard", "hit", "talkNeutral"
        };

        [Serializable]
        private sealed class ValidationReport
        {
            public string generatedAt;
            public string assetPath;
            public bool passed;
            public int skinnedMeshRenderers;
            public int materials;
            public int blendShapes;
            public int animationClips;
            public int maximumBoneInfluences;
            public List<string> failures = new();
            public List<string> warnings = new();
        }

        [MenuItem("Raonjena/Validation/Validate Selected Character")]
        private static void ValidateSelected()
        {
            var selected = Selection.activeObject;
            var assetPath = AssetDatabase.GetAssetPath(selected);
            var root = selected as GameObject;
            if (root == null && !string.IsNullOrEmpty(assetPath)) root = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
            if (root == null)
            {
                EditorUtility.DisplayDialog("Raon Validation", "Select an imported Raon GLB prefab or a character GameObject.", "OK");
                return;
            }

            var instance = PrefabUtility.InstantiatePrefab(root) as GameObject;
            if (instance == null) instance = UnityEngine.Object.Instantiate(root);
            try
            {
                var report = Validate(instance, assetPath);
                const string reportDirectory = "Assets/ValidationReports";
                Directory.CreateDirectory(reportDirectory);
                var reportPath = Path.Combine(reportDirectory, "RaonDeformationValidation.json");
                File.WriteAllText(reportPath, JsonUtility.ToJson(report, true));
                AssetDatabase.Refresh();
                Debug.Log($"Raon deformation validation {(report.passed ? "PASSED" : "FAILED")}: {reportPath}", root);
                if (!report.passed) Debug.LogError(string.Join("\n", report.failures), root);
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(instance);
            }
        }

        private static ValidationReport Validate(GameObject root, string assetPath)
        {
            var report = new ValidationReport
            {
                generatedAt = DateTime.UtcNow.ToString("O"),
                assetPath = assetPath
            };
            var renderers = root.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            report.skinnedMeshRenderers = renderers.Length;
            if (renderers.Length == 0) report.failures.Add("No SkinnedMeshRenderer was imported.");

            var transforms = root.GetComponentsInChildren<Transform>(true);
            var boneNames = transforms.Select(transform => transform.name).ToHashSet();
            var missingBones = RequiredBones.Where(name => !boneNames.Contains(name)).ToArray();
            if (missingBones.Length > 0) report.failures.Add($"Missing humanoid bones: {string.Join(", ", missingBones)}");

            foreach (var renderer in renderers)
            {
                if (renderer.sharedMesh == null)
                {
                    report.failures.Add($"{renderer.name}: missing mesh.");
                    continue;
                }
                report.materials += renderer.sharedMaterials.Count(material => material != null);
                report.blendShapes += renderer.sharedMesh.blendShapeCount;
                report.maximumBoneInfluences = Math.Max(report.maximumBoneInfluences, MaximumInfluenceCount(renderer.sharedMesh));
                if (!Finite(renderer.localBounds.center) || !Finite(renderer.localBounds.extents)) report.failures.Add($"{renderer.name}: non-finite renderer bounds.");
                if (renderer.localBounds.size.magnitude > 5f) report.warnings.Add($"{renderer.name}: unusually large bounds {renderer.localBounds.size}.");
                if (renderer.bones.Any(bone => bone == null)) report.failures.Add($"{renderer.name}: null bone reference.");
            }

            if (report.maximumBoneInfluences > 4) report.failures.Add($"Maximum bone influence count is {report.maximumBoneInfluences}; target is four.");
            if (report.blendShapes < 15) report.failures.Add($"Only {report.blendShapes} blend shapes were imported; target is at least 15.");

            var clips = string.IsNullOrEmpty(assetPath)
                ? Array.Empty<AnimationClip>()
                : AssetDatabase.LoadAllAssetsAtPath(assetPath).OfType<AnimationClip>().Where(clip => !clip.name.StartsWith("__preview__")).ToArray();
            report.animationClips = clips.Length;
            var clipNames = clips.Select(clip => clip.name).ToHashSet();
            var missingClips = RequiredClips.Where(name => !clipNames.Contains(name)).ToArray();
            if (missingClips.Length > 0) report.failures.Add($"Missing animation clips: {string.Join(", ", missingClips)}");

            foreach (var material in renderers.SelectMany(renderer => renderer.sharedMaterials).Where(material => material != null).Distinct())
            {
                if (material.name.Contains("HairCards") && material.renderQueue < 2450) report.warnings.Add("Hair-card material is not configured for alpha rendering.");
            }

            report.passed = report.failures.Count == 0;
            return report;
        }

        private static int MaximumInfluenceCount(Mesh mesh)
        {
            var maximum = 0;
            using var bonesPerVertex = mesh.GetBonesPerVertex();
            foreach (var count in bonesPerVertex) maximum = Math.Max(maximum, count);
            return maximum;
        }

        private static bool Finite(Vector3 value)
        {
            return float.IsFinite(value.x) && float.IsFinite(value.y) && float.IsFinite(value.z);
        }
    }
}
