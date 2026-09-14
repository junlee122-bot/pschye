// Playable adaptation of the existing river-incident choices, not new canon.
export const villageRescueApproaches = {
  'save-child': {
    label: '목소리로 잇는 길', action: '아이에게 길 알려 주기',
    instruction: '4·5열에서 세 번 길을 알려 주세요. 아이가 스스로 빠져나오면 라온도 1열로 돌아갑니다.',
    locationHint: '4·5열에 도착하면 길을 알려 줄 수 있습니다.',
    response: '네 목소리를 듣고 아이가 움직였어. 우리도 무사히 돌아왔네.',
  },
  'mark-safe-route': {
    label: '모두에게 보이는 길', action: '안전한 길에 돌 놓기',
    instruction: '2·3·4열에 각각 돌을 놓아 길을 이으세요. 세 표식이 모이면 1열로 돌아갑니다.',
    locationHint: '2·3·4열 중 아직 표식이 없는 열에서 돌을 놓을 수 있습니다.',
    response: '네가 놓은 돌을 따라 아이를 데리고 나왔어. 네가 본 길이 우리에게도 보였어.',
  },
  'draw-the-beast': {
    label: '시선을 돌리는 용기', action: '생물의 시선 끌기',
    instruction: '3·4·5열에서 세 번 시선을 끄세요. 카즈린이 아이를 꺼내면 라온도 1열로 돌아갑니다.',
    locationHint: '3·4·5열에서 시선을 끌 수 있습니다.',
    response: '그 틈에 아이를 꺼냈어. 너도 무사해서 다행이야.',
  },
};
