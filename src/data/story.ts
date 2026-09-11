import type { RaonStoryBeat, RaonStoryChoice, RaonStoryChoiceId } from '../types';

export const raonChoiceMeta: Record<RaonStoryChoiceId, {
  label: string;
  shortEffect: string;
  battleEffect: string;
}> = {
  compassion: {
    label: '연민',
    shortEffect: '사람을 먼저 본다',
    battleEffect: '보호 목표에 시작 방벽 +24',
  },
  insight: {
    label: '통찰',
    shortEffect: '감춰진 이유를 읽는다',
    battleEffect: '확인된 적 전원 노출 +1',
  },
  resolve: {
    label: '결의',
    shortEffect: '두려워도 먼저 걷는다',
    battleEffect: '전투 시작 사기 +20',
  },
};

export const raonChoiceConsequences: Record<RaonStoryChoiceId, {
  checkLabel: string;
  memory: string;
  clearReaction: string;
  costlyReaction: string;
}> = {
  compassion: {
    checkLabel: '마음을 지킬 수 있는가',
    memory: '위험 속에서도 사람을 숫자로 보지 않았다.',
    clearReaction: '그 선택 덕분에 동료는 라온의 보호선을 믿기 시작했다.',
    costlyReaction: '사람은 지켰지만, 동료는 그 대가까지 함께 기억한다.',
  },
  insight: {
    checkLabel: '감춰진 원인을 읽는가',
    memory: '보이는 적보다 그 뒤의 이유를 먼저 의심했다.',
    clearReaction: '동료는 라온이 자신이 놓친 틈까지 읽었다고 인정했다.',
    costlyReaction: '진실에는 닿았지만, 망설인 시간의 상처가 남았다.',
  },
  resolve: {
    checkLabel: '두려움보다 먼저 걷는가',
    memory: '누군가 먼저 나서야 할 때 자신의 이름을 걸었다.',
    clearReaction: '동료는 라온이 선두에 설 자격을 증명했다고 느꼈다.',
    costlyReaction: '길은 열었지만, 동료는 라온이 혼자 짊어지려 한 순간을 잊지 않는다.',
  },
};

function choices(
  compassion: Omit<RaonStoryChoice, 'id' | 'doctrine'>,
  insight: Omit<RaonStoryChoice, 'id' | 'doctrine'>,
  resolve: Omit<RaonStoryChoice, 'id' | 'doctrine'>,
): RaonStoryChoice[] {
  return [
    { id: 'compassion', doctrine: 'shelter', ...compassion },
    { id: 'insight', doctrine: 'counterfire', ...insight },
    { id: 'resolve', doctrine: 'counterfire', ...resolve },
  ];
}

export const raonStoryBeats: Record<string, RaonStoryBeat> = {
  'grey-bridge-escort': {
    missionId: 'grey-bridge-escort',
    scene: '회색 교각 · 첫 출전 17분 전',
    narration: '프시케의 검은 제복은 아직 남의 옷 같았다. 교각 아래에서 마차 바퀴가 떨렸고, 그 안의 사람들은 내가 내릴 첫 명령을 기다렸다.',
    monologue: '카즈린을 따라온 것뿐인데. 어째서 다들 내 대답을 기다리는 거지?',
    companionId: 'hadori',
    companionLine: '라온. 네가 먼저 보고 판단해. 틀리면 내가 막는다.',
    question: '총성이 들리기 전, 나는 무엇을 가장 먼저 지킬 것인가?',
    choices: choices(
      { title: '마차 곁을 떠나지 않는다', line: '적을 놓치더라도 사람을 잃지는 않겠다.', effect: '하도리와 함께 호송선을 단단히 고정한다.' },
      { title: '총성이 아닌 사선을 본다', line: '보이지 않는 적도 흔적은 남긴다.', effect: '크리스와 탄도·엄폐 위치를 먼저 읽는다.' },
      { title: '내가 먼저 교각에 오른다', line: '겁이 사라지길 기다리면 너무 늦다.', effect: '라온이 선두에서 적의 첫 반응을 끌어낸다.' },
    ),
    victoryReflection: '처음으로 내 검이 누군가의 귀환을 만들었다. 그런데 적은 그 꽃잎을 보고 ‘배신자’라고 불렀다.',
    defeatReflection: '검로만 보느라 사람들의 발을 보지 못했다. 다음에는 먼저 돌아갈 길부터 찾겠다.',
  },
  'citizen-cartridge': {
    missionId: 'citizen-cartridge',
    scene: '술집 시티즌 · 폐점 뒤',
    narration: '테이블 위 탄피 하나가 도시 전체의 거짓말보다 무거워 보였다. 크리스는 웃고 있었지만 눈은 출입문과 창문을 번갈아 훑었다.',
    monologue: '총을 든 사람이 악당인 건 쉽다. 총을 팔게 만든 사람이 누구인지 찾는 건 어렵다.',
    companionId: 'chris',
    companionLine: '정답을 고르지 마. 오늘은 누가 거짓말할 때 숨을 멈추는지만 보자.',
    question: '밀수망의 한가운데에서 누구의 말을 믿을 것인가?',
    choices: choices(
      { title: '겁먹은 종업원을 먼저 빼낸다', line: '증거는 다시 찾을 수 있어도 사람은 아니다.', effect: '민간인 대피로를 먼저 확보한다.' },
      { title: '탄피가 지나온 손을 역추적한다', line: '한 발의 총알에도 여러 사람의 선택이 묻어 있다.', effect: '밀수 장부와 사선을 동시에 추적한다.' },
      { title: '중개상 앞에 직접 모습을 드러낸다', line: '내가 미끼가 되면 적어도 누가 적인지는 보인다.', effect: '라온이 거래를 흔들어 적의 반응을 강제한다.' },
    ),
    victoryReflection: '악인은 한 명이 아니었다. 다음부터는 칼끝보다 그 칼을 쥐게 만든 손을 먼저 보겠다.',
    defeatReflection: '진실을 서두르다 입을 열 사람까지 몰아붙였다. 듣는 것도 전투라는 걸 잊었다.',
  },
  'empty-generation-village': {
    missionId: 'empty-generation-village',
    scene: '이름 없는 마을 · 제3기 추모벽',
    narration: '비어 있는 명패 아래에 수십 개의 이름이 긁혀 있었다. 공식 기록에는 없는 이름들이었다. 레오는 한참 동안 주먹을 펴지 않았다.',
    monologue: '죽은 사람의 이름을 지우면 실패도 사라지는 걸까. 그렇다면 왜 여기는 이렇게 아픈가.',
    companionId: 'leo',
    companionLine: '강한 사람보다, 끝까지 이름을 부를 사람이 필요해.',
    question: '살아남은 이들에게 나는 어떤 조장이 되어야 하는가?',
    choices: choices(
      { title: '모든 이름을 소리 내어 읽는다', line: '기억하는 사람이 남아 있으면 완전히 사라진 건 아니다.', effect: '생존자와 기록을 하나의 보호선에 둔다.' },
      { title: '총탄의 방향부터 복원한다', line: '누가 죽었는지와 누가 죽였는지는 함께 기록해야 한다.', effect: '참사 당시 사선을 재구성한다.' },
      { title: '다시는 같은 명령을 내리지 않겠다고 맹세한다', line: '두려움을 핑계로 뒤에 숨지는 않겠다.', effect: '라온이 제3기 생존자 앞에서 책임을 선언한다.' },
    ),
    victoryReflection: '조장은 앞에 서는 사람이 아니라, 돌아오지 못한 이름까지 데리고 가는 사람이었다.',
    defeatReflection: '영웅이 되려다 또 누군가를 기록으로만 남길 뻔했다. 살아 돌아오는 것이 먼저다.',
  },
  'wingless-convoy': {
    missionId: 'wingless-convoy',
    scene: '북부 검문선 · 날개 없는 호송대',
    narration: '아이들은 자신들의 붉은 머리를 천으로 가리고 있었다. 카즈린은 창을 들었지만, 누구를 적으로 정해야 할지 아직 말하지 않았다.',
    monologue: '내가 배운 역사에서는 저들이 적이었다. 내 눈앞에서는 그저 추위에 떠는 사람들이었다.',
    companionId: 'kazrin',
    companionLine: '명령은 명확해야 해. 하지만 명확하다는 게 잔인해도 된다는 뜻은 아니겠지.',
    question: '제국의 명령과 눈앞의 생명이 충돌할 때 무엇을 따를 것인가?',
    choices: choices(
      { title: '호송대 안으로 들어간다', line: '보호한다면 같은 사선 안에 서야 한다.', effect: '민간인과 조장단의 방어선을 합친다.' },
      { title: '추격대의 명령서를 확인한다', line: '제국의 문장이 진실까지 보증하지는 않는다.', effect: '위조 명령과 내부 협력자를 찾는다.' },
      { title: '검문선을 내 이름으로 연다', line: '벌을 받을 사람이 필요하다면 내가 받겠다.', effect: '라온이 현장 책임을 떠안고 돌파를 선언한다.' },
    ),
    victoryReflection: '적과 아군을 가르는 선은 피가 아니라 선택이었다. 적어도 오늘은 그렇게 믿기로 했다.',
    defeatReflection: '옳다고 생각하는 것만으로는 누구도 지켜지지 않는다. 선택에는 준비와 책임이 필요하다.',
  },
  'sky-gunfire': {
    missionId: 'sky-gunfire',
    scene: '체시 부유요새 · 돌입 직전',
    narration: '구름 위에서 포성이 울렸다. 감옥 명부 한쪽에는 제국이 지운 제1군단의 문장이 남아 있었다.',
    monologue: '배신자의 검이라면 왜 이토록 많은 사람이 그 이름을 지우려 했을까.',
    companionId: 'chris',
    companionLine: '호기심은 좋은데, 살아서 답을 들을 생각은 해 둬.',
    question: '해찬의 흔적 앞에서 나는 무엇을 선택할 것인가?',
    choices: choices(
      { title: '수감자부터 구한다', line: '진실도 살아 있는 사람의 입을 통해야 남는다.', effect: '승선교와 수감 구역을 우선 방어한다.' },
      { title: '삭제된 명부를 끝까지 읽는다', line: '누군가 감춘 이름이라면 더 자세히 봐야 한다.', effect: '제1군단 기록과 포대 구조를 동시에 분석한다.' },
      { title: '그 검이 내 검인지 직접 확인한다', line: '두려운 답이라도 남이 대신 정하게 두지 않겠다.', effect: '라온이 잔존 제1군단 앞에 16꽃잎을 드러낸다.' },
    ),
    victoryReflection: '해찬이라는 이름은 과거가 아니었다. 내 손에서 다시 움직이기 시작한 질문이었다.',
    defeatReflection: '답을 원하면서도 진실이 나를 바꿀 가능성은 두려워했다. 그 망설임이 칼끝을 늦췄다.',
  },
  'violet-infiltration': {
    missionId: 'violet-infiltration',
    scene: '황실 지하 기록층 · 봉인 해제 3분 전',
    narration: '니아의 실이 벽과 바닥을 가득 메웠다. 제국의 기록은 적이 아니라 우리를 막기 위해 움직이고 있었다.',
    monologue: '우리를 지키려고 만든 나라가, 우리가 알아야 할 것까지 지우고 있다.',
    companionId: 'kain',
    companionLine: '네 정의감 때문에 전부 죽으면 그게 더 우스운 결말이야. 이번엔 계산해.',
    question: '제국의 비밀을 마주한 나는 어디까지 감수할 것인가?',
    choices: choices(
      { title: '증언자를 먼저 탈출시킨다', line: '기록보다 사람의 기억이 먼저다.', effect: '봉인층의 생존자 퇴로를 확보한다.' },
      { title: '원본과 위조본을 대조한다', line: '분노하기 전에 누가 무엇을 바꿨는지 알아야 한다.', effect: '함정 주기와 삭제 명령의 근원을 읽는다.' },
      { title: '내 이름으로 봉인을 깬다', line: '진실을 본 책임도 내가 지겠다.', effect: '라온이 황실의 추적 대상이 되는 것을 감수한다.' },
    ),
    victoryReflection: '제국은 완전한 악도 완전한 구원도 아니었다. 그래서 더 어려운 선택이 남았다.',
    defeatReflection: '비밀을 폭로하는 것과 사람을 구하는 것을 같은 일이라 착각했다. 둘 다 해내야 했다.',
  },
  'cursed-border': {
    missionId: 'cursed-border',
    scene: '저주받은 경계 · 중립 회담장',
    narration: '제국군과 가람의 병력이 서로를 겨눈 가운데, 같은 총성이 양쪽 진영에서 울렸다. 누군가는 전쟁이 다시 시작되길 바랐다.',
    monologue: '누가 먼저 쐈는지를 정하는 순간, 나는 누가 죽어도 되는지도 정하게 된다.',
    companionId: 'hadori',
    companionLine: '명령해. 양쪽이 다 싫어해도 우리가 감당한다.',
    question: '증오가 이미 시작된 전장에서 무엇을 멈출 것인가?',
    choices: choices(
      { title: '양쪽 부상자를 같은 곳으로 옮긴다', line: '치료받는 동안만큼은 적이라는 이름을 내려놓게 한다.', effect: '회담장 중앙에 공동 보호선을 세운다.' },
      { title: '첫 총탄의 궤적을 증명한다', line: '오해를 멈추려면 모두가 볼 수 있는 사실이 필요하다.', effect: '위장 저격수와 좌표 탈취자를 추적한다.' },
      { title: '두 진영 사이에 혼자 선다', line: '누군가 먼저 무기를 내려야 한다면 내가 하겠다.', effect: '라온이 양측의 첫 공격을 자신에게 끌어낸다.' },
    ),
    victoryReflection: '공존은 서로 좋아하는 일이 아니라, 죽일 이유가 있어도 죽이지 않는 선택에서 시작됐다.',
    defeatReflection: '선의만으로 증오를 멈출 수는 없었다. 증명하고 설득하고 버틸 힘까지 필요했다.',
  },
  'stopped-petal': {
    missionId: 'stopped-petal',
    scene: '집단 기억층 · 멈춘 꽃잎 앞',
    narration: '완성된 해찬의 검이 기억 속에서 반복됐다. 아름다웠고, 그 아름다움만큼 그의 다리를 부수고 있었다.',
    monologue: '저 검을 따라가면 강해진다. 끝까지 따라가면 나도 같은 곳에서 부서진다.',
    companionId: 'leo',
    companionLine: '계승은 같은 상처를 입는 게 아니야. 다른 답을 남기는 거다.',
    question: '선대의 완성 앞에서 나는 어떤 검을 만들 것인가?',
    choices: choices(
      { title: '누구도 혼자 싸우게 두지 않는다', line: '해찬이 혼자 감당한 선택을 우리는 나눠 들겠다.', effect: '제7기의 피해와 보호를 하나의 흐름으로 묶는다.' },
      { title: '검의 자멸 구조를 해체한다', line: '완성된 모양이 아니라 완성되지 못한 이유를 본다.', effect: '해찬류의 보법 부담을 전신에 분산한다.' },
      { title: '해찬과 다른 다음 발을 내딛는다', line: '존경하기 때문에 그대로 끝내지 않겠다.', effect: '라온류의 첫 검로를 자신의 의지로 선언한다.' },
    ),
    victoryReflection: '나는 해찬의 검을 버리지 않았다. 그가 잃은 미래까지 이어 갈 수 있도록, 다음 한 걸음을 바꾸었다.',
    defeatReflection: '선대의 희생을 숭배하는 것만으로는 아무것도 바뀌지 않는다. 살아남는 답을 다시 만들겠다.',
  },
};

export function getRaonStoryBeat(missionId: string) {
  return raonStoryBeats[missionId];
}
