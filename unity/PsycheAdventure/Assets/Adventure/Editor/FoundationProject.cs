using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Raonjena.Adventure.Editor
{
    [InitializeOnLoad]
    public static class FoundationProject
    {
        public const string ScenePath = "Assets/Adventure/Scenes/RaonFoundation.unity";
        private const string PipelinePath = "Assets/Adventure/Settings/FoundationPipeline.asset";
        private const string RendererPath = "Assets/Adventure/Settings/FoundationRenderer.asset";

        static FoundationProject()
        {
            EditorApplication.delayCall += () =>
            {
                if (EditorApplication.isCompiling || EditorApplication.isPlayingOrWillChangePlaymode || AssetDatabase.IsAssetImportWorkerProcess()) return;
                if (AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(PipelinePath) == null) PrepareProject();
            };
        }

        [MenuItem("Raonjena/Adventure/Prepare Project")]
        public static void PrepareProject()
        {
            Directory.CreateDirectory("Assets/Adventure/Settings");
            AssetDatabase.Refresh();
            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(PipelinePath);
            if (pipeline == null)
            {
                var renderer = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(RendererPath);
                if (renderer == null)
                {
                    renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                    renderer.name = "FoundationRenderer";
                    renderer.renderingMode = RenderingMode.Forward;
                    AssetDatabase.CreateAsset(renderer, RendererPath);
                    ResourceReloader.ReloadAllNullIn(renderer, "Packages/com.unity.render-pipelines.universal");
                    EditorUtility.SetDirty(renderer);
                }
                pipeline = UniversalRenderPipelineAsset.Create(renderer);
                pipeline.name = "FoundationPipeline";
                pipeline.supportsHDR = false;
                pipeline.msaaSampleCount = 2;
                pipeline.renderScale = 1f;
                pipeline.shadowDistance = 30;
                pipeline.shadowCascadeCount = 1;
                pipeline.useSRPBatcher = true;
                pipeline.supportsCameraDepthTexture = false;
                pipeline.supportsCameraOpaqueTexture = false;
                AssetDatabase.CreateAsset(pipeline, PipelinePath);
            }
            GraphicsSettings.defaultRenderPipeline = pipeline;
            QualitySettings.renderPipeline = pipeline;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.companyName = "Raonjena";
            PlayerSettings.productName = "라온 · 첫걸음";
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.runInBackground = false;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.StandaloneWindows64, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.StandaloneWindows64, new[] { GraphicsDeviceType.Direct3D11 });
            PreserveRuntimeShaders();
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            Debug.Log("Raon foundation project prepared. Run EditMode/PlayMode tests before declaring engine verification complete.");
        }

        private static void PreserveRuntimeShaders()
        {
            var settings = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset").FirstOrDefault();
            if (settings == null) throw new InvalidOperationException("GraphicsSettings asset was not initialized.");
            var serialized = new SerializedObject(settings);
            var included = serialized.FindProperty("m_AlwaysIncludedShaders");
            if (included == null) throw new InvalidOperationException("Always-included shader setting was not found.");
            // The audited Raon asset uses metallic/roughness (opaque and alpha-blended)
            // materials only. Keep its variants for runtime GLB loading in a player.
            var shaders = new List<Shader>
            {
                Shader.Find("Universal Render Pipeline/Lit"),
                Shader.Find("Shader Graphs/glTF-pbrMetallicRoughness")
            };
            if (shaders.Count < 2 || shaders.Any(shader => shader == null))
                throw new InvalidOperationException("URP or glTF runtime shaders are missing. Wait for package import and run Prepare Project again.");
            foreach (var shader in shaders.Distinct())
            {
                bool exists = false;
                for (int i = 0; i < included.arraySize; i++) if (included.GetArrayElementAtIndex(i).objectReferenceValue == shader) exists = true;
                if (exists) continue;
                int at = included.arraySize;
                included.InsertArrayElementAtIndex(at);
                included.GetArrayElementAtIndex(at).objectReferenceValue = shader;
            }
            serialized.ApplyModifiedPropertiesWithoutUndo();
        }

        [MenuItem("Raonjena/Adventure/Open Foundation Scene")]
        public static void OpenScene()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            PrepareProject();
            EditorSceneManager.OpenScene(ScenePath);
        }

        public static void VerifyProject()
        {
            PrepareProject();
            string model = Path.Combine(Application.streamingAssetsPath, "Raon", "raon-unity-runtime.glb");
            if (!File.Exists(model)) throw new FileNotFoundException("Prepare the Unity PNG model from the repository first.", model);
            var scene = EditorSceneManager.OpenScene(ScenePath);
            var roots = scene.GetRootGameObjects();
            if (roots.SelectMany(root => root.GetComponentsInChildren<FoundationBootstrap>(true)).Count() != 1)
                throw new InvalidOperationException("Foundation scene must contain one bootstrap.");
            foreach (var item in roots.SelectMany(root => root.GetComponentsInChildren<Transform>(true)))
                if (GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(item.gameObject) > 0)
                    throw new InvalidOperationException("Missing script on " + item.name);
            Directory.CreateDirectory("TestResults");
            File.WriteAllText("TestResults/project-verification.json", JsonUtility.ToJson(new ProjectVerification
            {
                runId = GetCommandArgument("-foundationRunId"),
                editorVersion = Application.unityVersion,
                scene = ScenePath,
                compiledAndSceneOpened = true,
                physicsAndVisualPlaytestComplete = false
            }, true));
        }

        [MenuItem("Raonjena/Adventure/Build Windows Foundation")]
        public static void BuildWindows()
        {
            VerifyProject();
            Directory.CreateDirectory("Builds/RaonFoundation");
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = "Builds/RaonFoundation/RaonFoundation.exe",
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.Development
            });
            if (report.summary.result != BuildResult.Succeeded)
                throw new InvalidOperationException("Windows build failed: " + report.summary.result);
            File.WriteAllText("TestResults/build-verification.json", JsonUtility.ToJson(new BuildVerification
            {
                runId = GetCommandArgument("-foundationRunId"),
                editorVersion = Application.unityVersion,
                result = report.summary.result.ToString(),
                outputPath = "Builds/RaonFoundation/RaonFoundation.exe"
            }, true));
            Debug.Log("Windows foundation built; actual input and visual checks remain a separate gate.");
        }

        private static string GetCommandArgument(string name)
        {
            var arguments = Environment.GetCommandLineArgs();
            for (int index = 0; index + 1 < arguments.Length; index++)
                if (arguments[index] == name) return arguments[index + 1];
            return "manual-editor";
        }

        [Serializable]
        private sealed class ProjectVerification
        {
            public string runId;
            public string editorVersion;
            public string scene;
            public bool compiledAndSceneOpened;
            public bool physicsAndVisualPlaytestComplete;
        }

        [Serializable]
        private sealed class BuildVerification
        {
            public string runId;
            public string editorVersion;
            public string result;
            public string outputPath;
        }
    }
}
