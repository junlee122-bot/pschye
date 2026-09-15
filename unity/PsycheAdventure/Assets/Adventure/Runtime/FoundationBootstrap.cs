using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Raonjena.Adventure
{
    public sealed class FoundationBootstrap : MonoBehaviour
    {
        private readonly List<Material> materials = new();

        private void Awake()
        {
            Application.targetFrameRate = 60;
            Application.runInBackground = false;
            QualitySettings.vSyncCount = 1;
            Time.timeScale = 1f;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;

            var ground = MakeMaterial("Limestone", new Color(0.36f, 0.39f, 0.36f));
            var stone = MakeMaterial("Courtyard stone", new Color(0.5f, 0.5f, 0.44f));
            var dark = MakeMaterial("Weathered wood", new Color(0.19f, 0.22f, 0.22f));
            var brass = MakeMaterial("Route marks", new Color(0.66f, 0.49f, 0.23f));
            var backdrop = MakeMaterial("Hills", new Color(0.2f, 0.28f, 0.28f));

            Block("Courtyard ground", new Vector3(0, -0.3f, 0), new Vector3(34, 0.6f, 32), ground);
            Block("Camera wall", new Vector3(5, 1.5f, 1), new Vector3(0.5f, 3, 9), dark);
            Block("Tall stop wall", new Vector3(-4, 1.4f, 5), new Vector3(7, 2.8f, 0.5f), dark);
            Block("Jump hurdle", new Vector3(0, 0.43f, -1), new Vector3(3, 0.86f, 0.45f), stone);
            Block("Landing ledge", new Vector3(0, 0.6f, 6.5f), new Vector3(2.6f, 1.2f, 3), stone);
            for (int step = 0; step < 5; step++)
            {
                float height = (step + 1) * 0.22f;
                Block("Stair " + (step + 1), new Vector3(-8, height * 0.5f, -4 + step * 0.7f), new Vector3(2.7f, height, 0.7f), stone);
            }
            Block("Stair platform", new Vector3(-8, 0.55f, 0.5f), new Vector3(2.7f, 1.1f, 3), stone);
            Block("Walkable ramp", new Vector3(10, 0.35f, 4), new Vector3(3, 0.4f, 7), stone, new Vector3(-16, 0, 0));
            Block("Steep slope", new Vector3(11, 1.6f, -7), new Vector3(2.5f, 0.4f, 4), dark, new Vector3(-62, 0, 0));
            for (int index = 0; index < 11; index++)
                Block("Path inlay " + index, new Vector3(0, 0.008f, -10 + index * 1.9f), new Vector3(0.8f, 0.008f, 0.12f), brass, null, false);
            for (int index = 0; index < 8; index++)
            {
                float x = -14 + index * 4;
                Block("North pillar " + index, new Vector3(x, 1.7f, 14), new Vector3(0.7f, 3.4f, 0.7f), dark);
                Block("Pillar cap " + index, new Vector3(x, 3.5f, 14), new Vector3(1, 0.2f, 1), brass, null, false);
                Block("Distant ridge " + index, new Vector3(x * 3, 0, 48), new Vector3(16, 10 + index % 3 * 3, 12), backdrop, new Vector3(0, index * 17, 20));
            }

            var sun = new GameObject("Morning light").AddComponent<Light>();
            sun.transform.SetParent(transform);
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.89f, 0.72f);
            sun.intensity = 1.4f;
            sun.shadows = LightShadows.Soft;
            sun.transform.rotation = Quaternion.Euler(48, -35, 0);
            RenderSettings.sun = sun;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.46f, 0.55f, 0.63f);
            RenderSettings.ambientEquatorColor = new Color(0.3f, 0.33f, 0.33f);
            RenderSettings.ambientGroundColor = new Color(0.14f, 0.16f, 0.16f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color(0.37f, 0.46f, 0.5f);
            RenderSettings.fogStartDistance = 25;
            RenderSettings.fogEndDistance = 85;

            var player = new GameObject("Raon");
            player.transform.SetParent(transform);
            player.layer = 2; // Exclude the actor from the camera's default physics queries.
            player.transform.position = new Vector3(0, 0.12f, -9);
            var motor = player.AddComponent<RaonMotor>();

            var cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";
            cameraObject.transform.SetParent(transform);
            var camera = cameraObject.AddComponent<Camera>();
            camera.nearClipPlane = 0.1f;
            camera.farClipPlane = 110;
            camera.fieldOfView = 55;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = RenderSettings.fogColor;
            cameraObject.AddComponent<AudioListener>();
            var cameraData = camera.GetUniversalAdditionalCameraData();
            cameraData.renderPostProcessing = false;
            cameraData.antialiasing = AntialiasingMode.None;
            var rig = cameraObject.AddComponent<ThirdPersonCameraRig>();
            rig.Configure(player.transform);
            motor.Configure(camera.transform, player.transform.position);

            var visualObject = new GameObject("Raon visual");
            visualObject.layer = 2;
            visualObject.transform.SetParent(player.transform, false);
            var visual = visualObject.AddComponent<RaonVisual>();
            visual.Configure(motor);
            var input = gameObject.AddComponent<FoundationInputDriver>();
            input.Configure(motor, rig, visual);
            gameObject.AddComponent<FoundationHud>().Configure(input, motor, visual);
        }

        private Material MakeMaterial(string name, Color color)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) throw new System.InvalidOperationException("URP/Lit is missing. Run Raonjena > Adventure > Prepare Project first.");
            var material = new Material(shader) { name = name, color = color };
            material.SetFloat("_Smoothness", 0.12f);
            materials.Add(material);
            return material;
        }

        private void Block(string name, Vector3 position, Vector3 scale, Material material, Vector3? rotation = null, bool collides = true)
        {
            var item = GameObject.CreatePrimitive(PrimitiveType.Cube);
            item.name = name;
            item.transform.SetParent(transform);
            item.transform.position = position;
            item.transform.localScale = scale;
            if (rotation.HasValue) item.transform.rotation = Quaternion.Euler(rotation.Value);
            item.GetComponent<Renderer>().sharedMaterial = material;
            if (!collides) Destroy(item.GetComponent<Collider>());
        }

        private void OnDestroy()
        {
            foreach (var material in materials) if (material != null) Destroy(material);
        }
    }
}
