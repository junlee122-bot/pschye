import type {
  CraftRecipe,
  DailyActivityDefinition,
  DispatchDefinition,
  EquipmentDefinition,
  FactionDefinition,
  StrategicOrderDefinition,
} from '../types';

const archive = '/art/archive';
const generated = '/art/generated';

export const equipmentDefinitions: EquipmentDefinition[] = [
  { id: 'breaker-gauntlet', name: '보류된 파쇄 완갑', slot: 'weapon', rarity: 'rare', description: '하도리의 힘을 흩어 충격을 지면으로 보낸다.', hp: 18, armor: 3, power: 1, art: `${archive}/hadori-sheet.webp` },
  { id: 'petal-training-blade', name: '열여섯 홈 연습검', slot: 'weapon', rarity: 'rare', description: '마루가 기억한 검로를 복원하기 위해 홈을 낸 검.', hp: 4, armor: 0, power: 6, art: `${archive}/raon-sheet.webp` },
  { id: 'silver-orbit-lance', name: '백은 궤도창', slot: 'weapon', rarity: 'rare', description: '찌르기와 호위 궤도를 빠르게 전환하는 라티계 장창.', hp: 6, armor: 2, power: 5, art: `${archive}/kazrin-sheet.webp` },
  { id: 'valder-heir-spear', name: '발데르 계승창', slot: 'weapon', rarity: 'rare', description: '힘보다 가문의 이름이 더 무거운 조기교육용 창.', hp: 8, armor: 1, power: 6, art: `${archive}/kain-sheet.webp` },
  { id: 'gate-wraps', name: '진훤류 수문 붕대', slot: 'weapon', rarity: 'rare', description: '손목과 팔꿈치의 기본 각도를 강제로 유지한다.', hp: 14, armor: 3, power: 2, art: `${archive}/leo-sheet.webp` },
  { id: 'equilibrium-sabre', name: '리스트류 균형검', slot: 'weapon', rarity: 'rare', description: '결투와 호위를 같은 자세에서 시작하는 서양식 검.', hp: 5, armor: 1, power: 5, art: `${generated}/chris-sheet.webp` },
  { id: 'field-kit', name: '제5기 생환 장비', slot: 'support', rarity: 'common', description: '지혈끈, 표식못, 접이식 엄폐포를 묶은 표준 키트.', hp: 10, armor: 2, power: 0, art: `${generated}/generation-05-mending.webp` },
  { id: 'ballistic-cloak', name: '잿빛 방탄 망토', slot: 'support', rarity: 'rare', description: '체시 총탄의 파편을 분산하는 겹직물 망토.', hp: 12, armor: 4, power: 0, art: `${generated}/mission-grey-bridge.webp` },
  { id: 'resonance-bell', name: '아델린의 공명종', slot: 'support', rarity: 'epic', description: '시야가 끊긴 동료에게 귀환 방향을 알려주는 작은 종.', hp: 16, armor: 2, power: 3, art: `${generated}/mission-empty-generation.webp` },
  { id: 'wingless-token', name: '날개 없는 자의 인식표', slot: 'support', rarity: 'epic', description: '보호받은 생존자들이 제7기에게 건넨 이름표 묶음.', hp: 20, armor: 3, power: 2, art: `${generated}/mission-wingless-convoy.webp` },
  { id: 'first-legion-hilt', name: '제1군단 무명 검자루', slot: 'weapon', rarity: 'legendary', description: '삭제된 명부와 함께 회수된 해찬군의 표준 검자루.', hp: 8, armor: 2, power: 10, art: `${generated}/cheshi-sniper.webp` },
  { id: 'violet-archive-key', name: '바이올렛 봉인열쇠', slot: 'support', rarity: 'legendary', description: '니아의 함정식과 앤의 비공식 명령이 함께 새겨졌다.', hp: 14, armor: 5, power: 4, art: `${archive}/generation-04.webp` },
  { id: 'garam-coordinate', name: '가람의 공간좌표', slot: 'support', rarity: 'legendary', description: '권능은 사라졌지만 피난로의 좌표와 약속은 남았다.', hp: 22, armor: 3, power: 5, art: `${generated}/campaign-world-map.webp` },
  { id: 'stopped-petal', name: '멈춘 꽃잎', slot: 'weapon', rarity: 'legendary', description: '시간이 아니라 한 사람의 선택을 기억하는 금속 조각.', hp: 10, armor: 4, power: 12, art: `${archive}/legends-past-present-01.webp` },
  { id: 'timeworn-leg-brace', name: '멈춘 보법의 보조구', slot: 'support', rarity: 'legendary', description: '해찬의 망가진 보법을 흉내 내지 않고 안전하게 분석하기 위한 관절 보조구.', hp: 24, armor: 5, power: 3, art: `${archive}/haechan-sheet.png` },
  { id: 'command-wraps', name: '총사령관의 권포', slot: 'weapon', rarity: 'epic', description: '힘을 땅에 흘리고 다음 타격으로 연결하는 라미식 맨손격투 붕대.', hp: 12, armor: 2, power: 8, art: `${archive}/lami-sheet.png` },
  { id: 'rex-bandages', name: '렉스의 기본기 붕대', slot: 'weapon', rarity: 'epic', description: '관절 각도를 정직하게 고정하는 진훤류 훈련용 붕대.', hp: 18, armor: 4, power: 5, art: `${archive}/jinhwon-sheet.png` },
  { id: 'counter-lens', name: '현자의 카운터 렌즈', slot: 'support', rarity: 'epic', description: '상대의 중심 이동을 격자 기록으로 남기는 마루의 관찰 도구.', hp: 8, armor: 2, power: 8, art: `${archive}/maru-sheet.png` },
  { id: 'nia-thread-map', name: '황실 실선 지도', slot: 'support', rarity: 'legendary', description: '니아가 도시 전체를 함정과 피난선으로 동시에 읽기 위해 만든 지도.', hp: 18, armor: 6, power: 5, art: `${archive}/nabi-nia-sheet.png` },
];

export const factionDefinitions: FactionDefinition[] = [
  { id: 'empire', name: '프시케 제국', subtitle: '질서와 공식 기록', description: '니아의 행정과 진훤의 프시케가 유지하는 전후 국가.', accent: '#c6a468' },
  { id: 'civilians', name: '민간 공동체', subtitle: '살아 돌아올 권리', description: '호송민, 제3기 생존자, 재건 노동자와 길드의 연대.', accent: '#91a47d' },
  { id: 'cursed', name: '저주받은 땅', subtitle: '가람과 혼혈 생존자', description: '어느 종족에도 온전히 받아들여지지 못한 사람들의 자치권.', accent: '#8b6aa9' },
  { id: 'cheshi', name: '체시 생존권', subtitle: '권능을 잃은 잔존 세력', description: '공화국의 가해와 멸종 대상의 피해를 동시에 짊어진 집단.', accent: '#a65d58' },
];

export const strategicOrders: StrategicOrderDefinition[] = [
  {
    id: 'first-drill',
    title: '첫 번째 교범',
    subtitle: '조장 한 명을 훈련하십시오',
    description: '강함보다 먼저, 누구를 성장시킬지 선택하는 것이 지휘의 시작입니다.',
    stat: 'trainings',
    goal: 1,
    targetSection: 'activities',
    reward: { supplies: 60, intel: 10, relics: 0, renown: 4 },
  },
  {
    id: 'balanced-command',
    title: '균형 잡힌 하루',
    subtitle: '일일 지휘 보상을 1회 수령하십시오',
    description: '전투력·관계·현장을 함께 돌보는 날이 다음 전투의 생환율을 높입니다.',
    stat: 'perfectDays',
    goal: 1,
    targetSection: 'activities',
    reward: { supplies: 40, intel: 35, relics: 1, renown: 8 },
  },
  {
    id: 'first-return',
    title: '첫 생환 보고',
    subtitle: '주 작전 1개를 완료하십시오',
    description: '승리보다 중요한 것은 전원이 귀환해 다음 기록을 남기는 일입니다.',
    stat: 'missions',
    goal: 1,
    targetSection: 'campaign',
    reward: { supplies: 100, intel: 25, relics: 1, renown: 12 },
  },
  {
    id: 'field-doctrine',
    title: '현장의 목소리',
    subtitle: '현장 활동을 3회 수행하십시오',
    description: '작전실 밖에서 얻은 정보가 지도 위 숫자보다 더 정확할 때가 있습니다.',
    stat: 'fieldActivities',
    goal: 3,
    targetSection: 'activities',
    reward: { supplies: 80, intel: 40, relics: 0, renown: 10 },
  },
  {
    id: 'trusted-pair',
    title: '두 사람의 궤도',
    subtitle: '유대 훈련을 3회 수행하십시오',
    description: '한 사람의 재능보다 두 사람이 서로의 빈틈을 아는 편이 강합니다.',
    stat: 'bonds',
    goal: 3,
    targetSection: 'activities',
    reward: { supplies: 45, intel: 55, relics: 0, renown: 12 },
  },
  {
    id: 'legacy-forge',
    title: '선대의 흔적',
    subtitle: '유산 장비를 1개 복원하십시오',
    description: '기술은 모방하는 것이 아니라, 지금의 몸과 목적에 맞게 다시 만드는 것입니다.',
    stat: 'crafts',
    goal: 1,
    targetSection: 'activities',
    reward: { supplies: 70, intel: 20, relics: 2, renown: 10 },
  },
];

export const dispatchOperations: DispatchDefinition[] = [
  { id: 'bridge-salvage', title: '교각 잔해 회수', subtitle: '모이라의 길 표시', description: '붕괴 위험 구간에서 탄피와 철도 부품을 회수한다.', requiredMission: 'grey-bridge-escort', cost: 35, days: 1, reward: { supplies: 85, intel: 20, relics: 0, faction: { civilians: 3 } } },
  { id: 'citizen-witness', title: '시티즌 증인 호송', subtitle: '테나의 비공식 부탁', description: '밀수 장부를 읽은 종업원을 의회 증언대까지 보낸다.', requiredMission: 'citizen-cartridge', cost: 50, days: 2, reward: { supplies: 40, intel: 75, relics: 1, faction: { empire: -2, civilians: 6 }, equipmentId: 'ballistic-cloak' } },
  { id: 'third-memorial', title: '제3기 이름 수습', subtitle: '아델린의 귀환 명령', description: '공식 문서에서 누락된 전사자 유품과 이름을 수습한다.', requiredMission: 'empty-generation-village', cost: 65, days: 2, reward: { supplies: 55, intel: 90, relics: 1, faction: { civilians: 8 }, equipmentId: 'resonance-bell' } },
  { id: 'wingless-route', title: '날개 없는 피난로', subtitle: '미르의 의료 호송', description: '실험체가 추적당하지 않는 장기 피난 경로를 확보한다.', requiredMission: 'wingless-convoy', cost: 80, days: 3, reward: { supplies: 90, intel: 70, relics: 2, faction: { empire: -4, cursed: 10, civilians: 5 }, equipmentId: 'wingless-token' } },
  { id: 'sky-wreckage', title: '공중 요새 잔해 조사', subtitle: '스피노자의 기술 요청', description: '체시 화기와 비행 장치의 결합 방식을 분석한다.', requiredMission: 'sky-gunfire', cost: 95, days: 3, reward: { supplies: 135, intel: 105, relics: 2, faction: { empire: 4, cheshi: -3 } } },
  { id: 'border-parley', title: '경계 마을 정전 감시', subtitle: '캄프타의 중재', description: '제국과 저주받은 땅 양쪽의 보복 공격을 동시에 막는다.', requiredMission: 'cursed-border', cost: 120, days: 4, reward: { supplies: 150, intel: 125, relics: 3, faction: { empire: 2, cursed: 8, civilians: 6 } } },
];

export const dailyActivities: DailyActivityDefinition[] = [
  {
    id: 'city-watch',
    title: '수도 야간 순찰',
    subtitle: '귀족가와 피난민 구역 사이',
    description: '전투보다 민원과 분쟁이 많은 수도 외곽을 순찰해 시민의 신뢰를 쌓는다.',
    art: `${archive}/generation-07.webp`,
    actionCost: 1,
    suppliesCost: 10,
    intelCost: 0,
    reward: { supplies: 30, intel: 12, relics: 0, renown: 8, faction: { civilians: 3, empire: 1 } },
  },
  {
    id: 'rail-salvage',
    title: '구철도 회수 작업',
    subtitle: '모이라의 귀환 표식',
    description: '회색 교각 주변의 탄피와 철재를 회수하고 안전한 후퇴 표식을 갱신한다.',
    art: `${generated}/mission-grey-bridge.webp`,
    actionCost: 1,
    suppliesCost: 5,
    intelCost: 0,
    requiredMission: 'grey-bridge-escort',
    reward: { supplies: 65, intel: 8, relics: 1, renown: 5, faction: { civilians: 2 } },
  },
  {
    id: 'archive-decoding',
    title: '삭제 기록 복원',
    subtitle: '이름 없는 제1군단 문서',
    description: '정보를 소모해 검게 지워진 문장과 인물 관계를 한 줄씩 복원한다.',
    art: `${archive}/archive-cover.webp`,
    actionCost: 1,
    suppliesCost: 0,
    intelCost: 25,
    reward: { supplies: 0, intel: 8, relics: 2, renown: 12, faction: { empire: -1, civilians: 2 } },
  },
  {
    id: 'border-mediation',
    title: '국경 정전 중재',
    subtitle: '가람의 좌표가 남은 길',
    description: '제국 초소와 혼혈 마을의 보복전을 막고 실종된 민간인을 양측에 돌려보낸다.',
    art: `${archive}/legends-past-present-02.webp`,
    actionCost: 2,
    suppliesCost: 35,
    intelCost: 10,
    requiredMission: 'cursed-border',
    reward: { supplies: 20, intel: 35, relics: 2, renown: 20, faction: { empire: 1, cursed: 5, civilians: 3 } },
  },
  {
    id: 'field-triage',
    title: '대화기 구조 훈련',
    subtitle: '봉합의 5기 생환 교범',
    description: '총격과 붕괴 상황을 재현해 부상자 탐색, 엄폐, 후송 순서를 반복한다.',
    art: `${generated}/generation-05-mending.webp`,
    actionCost: 1,
    suppliesCost: 20,
    intelCost: 0,
    requiredMission: 'empty-generation-village',
    reward: { supplies: 5, intel: 20, relics: 0, renown: 14, faction: { civilians: 4 } },
  },
  {
    id: 'cheshi-signal-hunt',
    title: '체시 신호 추적',
    subtitle: '권능 없는 시대의 공중전',
    description: '공중 저격대의 암호 신호를 역추적하되 비전투 체시의 피난 주파수는 보호한다.',
    art: `${generated}/cheshi-sniper.webp`,
    actionCost: 2,
    suppliesCost: 25,
    intelCost: 20,
    requiredMission: 'sky-gunfire',
    reward: { supplies: 45, intel: 70, relics: 3, renown: 24, faction: { cheshi: 3, empire: 2 } },
  },
];

export const craftRecipes: CraftRecipe[] = [
  { equipmentId: 'command-wraps', forgeLevel: 1, supplies: 90, relics: 1 },
  { equipmentId: 'rex-bandages', forgeLevel: 1, supplies: 100, relics: 1 },
  { equipmentId: 'counter-lens', forgeLevel: 2, supplies: 125, relics: 2 },
  { equipmentId: 'timeworn-leg-brace', forgeLevel: 2, supplies: 150, relics: 3 },
  { equipmentId: 'nia-thread-map', forgeLevel: 3, supplies: 190, relics: 4 },
];

export function getEquipment(equipmentId: string) {
  return equipmentDefinitions.find((equipment) => equipment.id === equipmentId);
}
