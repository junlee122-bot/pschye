using UnityEngine;

namespace Raonjena.Adventure
{
    public sealed class FoundationHud : MonoBehaviour
    {
        private FoundationInputDriver input;
        private RaonMotor motor;
        private RaonVisual visual;
        private Font font;
        private GUIStyle title, body, muted, panel, button;

        public void Configure(FoundationInputDriver driver, RaonMotor actor, RaonVisual model)
        {
            input = driver;
            motor = actor;
            visual = model;
        }

        private void EnsureStyles()
        {
            if (title != null) return;
            font = Font.CreateDynamicFontFromOSFont(new[] { "Malgun Gothic", "Arial" }, 18);
            title = new GUIStyle(GUI.skin.label) { font = font, fontSize = 25, fontStyle = FontStyle.Bold, wordWrap = true };
            title.normal.textColor = new Color(0.94f, 0.84f, 0.62f);
            body = new GUIStyle(GUI.skin.label) { font = font, fontSize = 15, wordWrap = true };
            body.normal.textColor = new Color(0.94f, 0.94f, 0.9f);
            muted = new GUIStyle(body) { fontSize = 13 };
            muted.normal.textColor = new Color(0.73f, 0.79f, 0.8f);
            panel = new GUIStyle(GUI.skin.box) { padding = new RectOffset(18, 18, 12, 12) };
            button = new GUIStyle(GUI.skin.button) { font = font, fontSize = 16, padding = new RectOffset(14, 14, 10, 10) };
        }

        private void OnGUI()
        {
            if (input == null || visual == null || motor == null) return;
            EnsureStyles();
            float width = Mathf.Min(420f, Screen.width - 24f);
            GUILayout.BeginArea(new Rect(12, 12, width, 210), panel);
            GUILayout.Label("라온 · 첫걸음", title);
            GUILayout.Label("움직임을 익히는 연습장", body);
            GUILayout.Label("계단을 오르고 낮은 벽을 뛰어넘어 보세요.\n높은 벽 옆에서 시선을 돌려 볼 수 있습니다.", muted);
            GUILayout.Label("조작 연습은 본편의 선택과 저장을 바꾸지 않습니다.", muted);
            GUILayout.EndArea();

            GUILayout.BeginArea(new Rect(12, Mathf.Max(226, Screen.height - 130), Mathf.Min(660, Screen.width - 24), 118), panel);
            GUILayout.Label("WASD / 방향키  이동     Shift  달리기     Space  점프", body);
            GUILayout.Label("오른쪽 드래그  시선     휠  거리     C  시선 정렬", body);
            GUILayout.Label("R  시작점     Esc  쉬기 / 계속     F3  상태 확인", muted);
            GUILayout.EndArea();

            if (!visual.IsReady || input.Paused)
            {
                float modalWidth = Mathf.Min(450, Screen.width - 24);
                GUILayout.BeginArea(new Rect((Screen.width - modalWidth) * 0.5f, Mathf.Max(230, Screen.height * 0.34f), modalWidth, 245), panel);
                if (visual.Status == "Failed")
                {
                    GUILayout.Label("라온을 불러오지 못했습니다", title);
                    GUILayout.Label(visual.FailureReason, body);
                    if (GUILayout.Button("다시 불러오기", button)) visual.Reload();
                }
                else if (!visual.IsReady)
                {
                    GUILayout.Label("라온을 불러오는 중", title);
                    GUILayout.Label("모델이 준비되면 움직일 수 있습니다.", body);
                }
                else
                {
                    GUILayout.Label("잠시 쉬어 가기", title);
                    GUILayout.Label("돌아오면 같은 자리에서 이어집니다.", body);
                    if (GUILayout.Button("계속하기", button)) input.SetPaused(false);
                    if (GUILayout.Button("시작점으로", button)) { input.ResetPractice(); input.SetPaused(false); }
                }
                GUILayout.EndArea();
            }

            if (input.ShowDiagnostics)
            {
                float debugWidth = Mathf.Min(340, Screen.width - 24);
                GUILayout.BeginArea(new Rect(Screen.width - debugWidth - 12, 230, debugWidth, 180), panel);
                GUILayout.Label("조작 상태 · F3 닫기", body);
                GUILayout.Label($"모델 {visual.Status}\n속도 {motor.CurrentSpeed:F2} m/s\n접지 {motor.Grounded} · 수직 {motor.VerticalSpeed:F2}\n위치 {motor.transform.position:F2}\n제작 후보 모델 · 최종 외형 검수 전", muted);
                GUILayout.EndArea();
            }
        }

        private void OnDestroy()
        {
            if (font != null) Destroy(font);
        }
    }
}
