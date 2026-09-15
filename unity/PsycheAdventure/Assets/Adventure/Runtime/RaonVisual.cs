using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using GLTFast;
using GLTFast.Logging;
using UnityEngine;

namespace Raonjena.Adventure
{
    /// <summary>
    /// Displays the existing automatic-retopology candidate, not a finished character.
    /// glTFast 6.20 Legacy clips animate a separate scene below the physical motor.
    /// Runtime structural checks do not certify deformation or final material quality.
    /// </summary>
    public sealed class RaonVisual : MonoBehaviour
    {
        public const string ModelFileName = "raon-unity-runtime.glb";
        // Current production-v2 POSITION minimum, retained by the PNG-only conversion.
        public const float SourceSoleHeight = 0.00051146385f;
        public const string CandidateNotice = "임시 라온 모델 · 관절 변형과 최종 재질은 실기 검수 전입니다.";

        private RaonMotor motor;
        private CancellationTokenSource loadCancellation;
        private int generation;
        private GltfImport activeImport;
        private GameObject activeInstance;
        private Animation legacyAnimation;
        private string currentClip;
        private bool hasJump;
        private bool hasFall;

        public string Status { get; private set; } = "Loading";
        public string FailureReason { get; private set; } = "";
        public string AnimationNotice { get; private set; } = "";
        public string ImportWarnings { get; private set; } = "";
        public bool IsReady => Status == "Ready" && activeInstance != null && legacyAnimation != null;

        public void Configure(RaonMotor raonMotor)
        {
            motor = raonMotor;
            if (isActiveAndEnabled) Reload();
        }

        private void OnEnable()
        {
            if (motor != null) Reload();
        }

        public void Reload()
        {
            if (!isActiveAndEnabled) return;
            InvalidateLoad();
            Status = "Loading";
            FailureReason = "";
            AnimationNotice = "";
            ImportWarnings = "";
            var cancellation = new CancellationTokenSource();
            loadCancellation = cancellation;
            _ = LoadAsync(generation, cancellation);
        }

        private async Task LoadAsync(int request, CancellationTokenSource cancellation)
        {
            GltfImport importer = null;
            GameObject staging = null;
            var logger = new CollectingLogger();
            try
            {
                if (motor == null) throw new InvalidOperationException("라온 이동 컴포넌트가 연결되지 않았습니다.");
                importer = new GltfImport(logger: logger);
                var settings = new ImportSettings
                {
                    AnimationMethod = AnimationMethod.Legacy,
                    NodeNameMethod = NameImportMethod.OriginalUnique,
                    GenerateMipMaps = true,
                    AnisotropicFilterLevel = 2
                };
                var uri = StreamingAssetUri(Application.streamingAssetsPath);
                if (!await importer.Load(uri, settings, cancellation.Token))
                    throw new InvalidOperationException("라온 모델 파일을 읽지 못했습니다.");
                if (!IsCurrent(request, cancellation)) return;
                ThrowOnImportErrors(logger);

                // Remains inactive and detached until the whole scene passes validation.
                // SceneObjectCreation.Always keeps Animation off both this wrapper and the motor.
                staging = new GameObject("Raon imported candidate");
                staging.SetActive(false);
                staging.layer = gameObject.layer;
                var instantiator = new GameObjectInstantiator(importer, staging.transform, logger,
                    new InstantiationSettings
                    {
                        SceneObjectCreation = SceneObjectCreation.Always,
                        SkinUpdateWhenOffscreen = true,
                        Layer = gameObject.layer,
                        Mask = ComponentType.Mesh | ComponentType.Animation
                    });
                if (!await importer.InstantiateMainSceneAsync(instantiator, cancellation.Token))
                    throw new InvalidOperationException("라온 장면을 구성하지 못했습니다.");
                if (!IsCurrent(request, cancellation)) return;
                ThrowOnImportErrors(logger);
                var animation = instantiator.SceneInstance?.LegacyAnimation;
                ValidateInstance(importer, staging, animation);

                hasJump = IsPlayable(animation, "jump");
                hasFall = IsPlayable(animation, "fall");
                AnimationNotice = hasJump
                    ? "기존 jump 클립을 사용합니다. 별도 낙하 클립과 발 접지 보정은 없습니다."
                    : "jump 클립이 없어 공중에서는 " + (hasFall ? "fall" : "idle") + " 클립을 사용합니다.";
                ImportWarnings = ReadWarnings(logger);
                foreach (AnimationState state in animation)
                    state.wrapMode = state.name == "jump" || state.name == "fall" ? WrapMode.ClampForever : WrapMode.Loop;
                animation.playAutomatically = false;
                animation.cullingType = AnimationCullingType.AlwaysAnimate;

                // Source is already Y-up, +Z forward (toe direction), approximately 1.779 m.
                // Do not rotate it by 90 degrees or rescale it as a Blender Z-up source.
                staging.transform.SetParent(transform, false);
                staging.transform.localPosition = new Vector3(0, -SourceSoleHeight, 0);
                staging.transform.localRotation = Quaternion.identity;
                staging.transform.localScale = Vector3.one;
                activeInstance = staging;
                activeImport = importer;
                legacyAnimation = animation;
                staging = null;
                importer = null;
                activeInstance.SetActive(true);
                currentClip = null;
                PlayClip("idle");
                Status = "Ready";
            }
            catch (OperationCanceledException) { /* Superseded, disabled or destroyed. */ }
            catch (Exception exception)
            {
                if (IsCurrent(request, cancellation))
                {
                    // Also cover a failure during the final activation/first clip.
                    // Once committed, these resources no longer belong to staging.
                    var failedInstance = activeInstance;
                    var failedImport = activeImport;
                    activeInstance = null;
                    activeImport = null;
                    legacyAnimation = null;
                    await ReleaseAsync(failedInstance, failedImport);
                    if (!IsCurrent(request, cancellation)) return;
                    Status = "Failed";
                    FailureReason = exception.Message + ReadErrorSuffix(logger);
                    Debug.LogWarning("Raon candidate load failed: " + FailureReason, this);
                }
            }
            finally
            {
                await ReleaseAsync(staging, importer);
                if (loadCancellation == cancellation) loadCancellation = null;
                cancellation.Dispose();
            }
        }

        private bool IsCurrent(int request, CancellationTokenSource cancellation) =>
            this != null && isActiveAndEnabled && request == generation && !cancellation.IsCancellationRequested;

        private void Update()
        {
            if (!IsReady || motor == null) return;
            var next = ChooseLocomotionClip(motor.CurrentSpeed, motor.Grounded, motor.VerticalSpeed,
                motor.WalkSpeed, hasJump, hasFall);
            if (next != currentClip) PlayClip(next);
        }

        public static string ChooseLocomotionClip(float speed, bool grounded, float verticalSpeed,
            float walkSpeed, bool jumpAvailable, bool fallAvailable)
        {
            if (!grounded)
            {
                if (verticalSpeed <= 0 && fallAvailable) return "fall";
                return jumpAvailable ? "jump" : fallAvailable ? "fall" : "idle";
            }
            if (speed < 0.08f) return "idle";
            return speed > walkSpeed + 0.2f ? "run" : "walk";
        }

        private void PlayClip(string name)
        {
            var state = legacyAnimation[name];
            state.time = 0;
            if (currentClip == null) legacyAnimation.Play(name);
            else legacyAnimation.CrossFade(name, 0.12f);
            currentClip = name;
        }

        public static string StreamingAssetUri(string streamingAssetsPath)
        {
            // Android/WebGL already provide a URL; Windows/macOS paths need a file URI.
            if (streamingAssetsPath.Contains("://"))
                return streamingAssetsPath.TrimEnd('/') + "/Raon/" + ModelFileName;
            return new Uri(Path.Combine(streamingAssetsPath, "Raon", ModelFileName)).AbsoluteUri;
        }

        private static bool IsPlayable(Animation animation, string name) => animation != null &&
            animation[name] != null && animation[name].clip != null && animation[name].clip.legacy &&
            animation[name].length > 0 && !float.IsInfinity(animation[name].length);

        private static void ValidateInstance(GltfImport importer, GameObject instance, Animation animation)
        {
            if (importer.MaterialCount != 8 || importer.TextureCount != 22)
                throw new InvalidOperationException("라온 재질 8개·텍스처 22개를 모두 읽지 못했습니다.");
            for (var index = 0; index < importer.TextureCount; index++)
                if (importer.GetTexture(index) == null)
                    throw new InvalidOperationException("라온 텍스처가 누락되었습니다: " + index);
            for (var index = 0; index < importer.MaterialCount; index++)
            {
                var material = importer.GetMaterial(index);
                if (material == null || material.shader == null || !material.shader.isSupported)
                    throw new InvalidOperationException("라온 재질 셰이더를 사용할 수 없습니다: " + index);
            }
            // Read the importer's retained matrices rather than CPU mesh data, which
            // glTFast may release after uploading a mesh to the GPU.
            var bindPoses = importer.GetBindPoses(0);
            if (bindPoses == null || bindPoses.Length != 33)
                throw new InvalidOperationException("라온 역바인드 행렬 33개가 누락되었습니다.");
            foreach (var matrix in bindPoses)
                for (var value = 0; value < 16; value++)
                    if (float.IsNaN(matrix[value]) || float.IsInfinity(matrix[value]))
                        throw new InvalidOperationException("라온 역바인드 행렬에 유효하지 않은 값이 있습니다.");
            var skins = instance.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            if (skins.Length < 2) throw new InvalidOperationException("라온 몸과 머리카락의 스킨 메시가 누락되었습니다.");
            var hasFaceMorphs = false;
            foreach (var skin in skins)
            {
                var mesh = skin.sharedMesh;
                if (mesh == null || mesh.vertexCount == 0 || skin.bones.Length != 33)
                    throw new InvalidOperationException("라온 메시 또는 33개 관절 연결이 유효하지 않습니다.");
                foreach (var bone in skin.bones)
                    if (bone == null || !bone.IsChildOf(instance.transform))
                        throw new InvalidOperationException("라온 관절이 시각 모델 안에 연결되지 않았습니다.");
                foreach (var material in skin.sharedMaterials)
                    if (material == null) throw new InvalidOperationException("라온 스킨 재질이 누락되었습니다.");
                hasFaceMorphs |= mesh.blendShapeCount >= 20;
            }
            if (!hasFaceMorphs) throw new InvalidOperationException("라온 표정 모프 20개를 읽지 못했습니다.");
            foreach (var clip in new[] { "idle", "walk", "run" })
                if (!IsPlayable(animation, clip)) throw new InvalidOperationException("필수 동작 클립이 없습니다: " + clip);
        }

        private static void ThrowOnImportErrors(CollectingLogger logger)
        {
            if (logger.Items == null) return;
            foreach (var item in logger.Items)
                if (item.Type == LogType.Error || item.Type == LogType.Exception || item.Type == LogType.Assert)
                    throw new InvalidOperationException("라온 가져오기 오류: " + item);
        }

        private static string ReadWarnings(CollectingLogger logger)
        {
            var text = new StringBuilder();
            if (logger.Items != null)
                foreach (var item in logger.Items)
                    if (item.Type == LogType.Warning) text.AppendLine(item.ToString());
            return text.ToString().Trim();
        }

        private static string ReadErrorSuffix(CollectingLogger logger)
        {
            if (logger.Items != null)
                foreach (var item in logger.Items)
                    if (item.Type == LogType.Error) return " (" + item + ")";
            return "";
        }

        private void OnDisable()
        {
            InvalidateLoad();
            Status = "Loading";
        }

        private void InvalidateLoad()
        {
            generation++;
            loadCancellation?.Cancel();
            loadCancellation = null;
            legacyAnimation = null;
            currentClip = null;
            var previousInstance = activeInstance;
            var previousImport = activeImport;
            activeInstance = null;
            activeImport = null;
            _ = ReleaseAsync(previousInstance, previousImport);
        }

        private static async Task ReleaseAsync(GameObject instance, GltfImport importer)
        {
            if (instance != null)
            {
                instance.SetActive(false);
                if (Application.isPlaying)
                {
                    Destroy(instance);
                    // Destroy is deferred. Keep meshes/materials alive until renderers are gone.
                    while (instance != null) await Task.Yield();
                }
                else DestroyImmediate(instance);
            }
            importer?.Dispose();
        }
    }
}
