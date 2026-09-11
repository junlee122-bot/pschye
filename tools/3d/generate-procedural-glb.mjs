import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'public', 'models', 'characters');
const catalogPath = path.join(projectRoot, 'public', 'data', 'model-runtime-catalog.json');

const roster = [
  ['abel', '아벨'], ['achero', '아케로'], ['adeline', '아델린'], ['akari', '아카리'],
  ['ann', '앤'], ['bao', '바오'], ['bellatrice', '벨라트리체'], ['boksonga', '복송아'],
  ['brigitte', '브리짓'], ['chasey', '체이시'], ['chris', '크리스'], ['colin', '콜린'],
  ['crowd', '크라우드'], ['dimitri', '디미트리'], ['eitan', '에이탄'], ['elaine', '일레인'],
  ['evan', '에반'], ['garam', '가람'], ['guillaume', '기욤'], ['hadori', '하도리'],
  ['haechan', '해찬'], ['jinhwon', '진훤'], ['kael', '카엘'], ['kain', '카인'],
  ['kampta', '캄프타'], ['kangrim', '강림'], ['kazrin', '카즈린'], ['kitty', '키티'],
  ['laila', '라일라'], ['lami', '라미'], ['leo', '레오'], ['list', '리스트'],
  ['lucas', '루카스'], ['luka', '루카'], ['maru', '마루'], ['mire', '미르'],
  ['moira', '모이라'], ['nabi-nia', '나비 / 니아'], ['night', '나이트'], ['perseus', '페르세우스'],
  ['raon', '라온'], ['remesis', '레메시스'], ['rose', '로즈'], ['sebastian', '세바스티안'],
  ['spinoza', '스피노자'], ['tena-elion', '테나 엘리온'], ['volver', '볼버'], ['yeri', '예리'],
];
const showcaseOrder = [
  'raon', 'hadori', 'kazrin', 'kain', 'leo', 'chris',
  'haechan', 'lami', 'jinhwon', 'ann', 'maru', 'nabi-nia', 'garam',
];
roster.sort((left, right) => {
  const leftIndex = showcaseOrder.indexOf(left[0]);
  const rightIndex = showcaseOrder.indexOf(right[0]);
  if (leftIndex !== -1 || rightIndex !== -1) {
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  }
  return left[1].localeCompare(right[1], 'ko');
});

const stageById = {
  jinhwon: '프시케 제1기 1조장', ann: '프시케 제1기 2조장', kangrim: '프시케 제1기 3조장',
  mire: '프시케 제1기 4조장', maru: '프시케 비공식 제5조장',
  luka: '프시케 제2기 1조장', perseus: '프시케 제2기 2조장', guillaume: '프시케 제2기 3조장',
  spinoza: '프시케 제2기 4조장', kitty: '프시케 제2기 5조장',
  rose: '프시케 제4기 1조장', chasey: '프시케 제4기 2조장', bao: '프시케 제4기 3조장',
  list: '프시케 제4기 4조장', volver: '프시케 제4기 5조장',
  crowd: '프시케 제5기 1조장', kampta: '프시케 제5기 2조장', adeline: '프시케 제5기 3조장',
  brigitte: '프시케 제5기 4조장', abel: '프시케 제5기 5조장', moira: '프시케 제5기 정찰대장',
  sebastian: '프시케 제6기 1조장', elaine: '프시케 제6기 2조장', lucas: '프시케 제6기 3조장',
  dimitri: '프시케 제6기 4조장',
  hadori: '프시케 제7기 1조장', raon: '프시케 입단 초기', kazrin: '프시케 제7기 3조장',
  kain: '프시케 제7기 4조장', leo: '프시케 제7기 5조장', chris: '프시케 제7기 6조장',
  lami: '대전쟁 반란군 총사령관', haechan: '대전쟁 제1군단장', 'nabi-nia': '대전쟁 제2군단장 / 현 여황제',
  garam: '대전쟁 제6군단장', achero: '체시 지배자', remesis: '체시 공화국 제1장로', kael: '체시 공화국 제2장로',
};

const explicitConfigs = {
  raon: {
    id: 'raon',
    name: '라온',
    stage: '프시케 입단 초기',
    height: 1.78,
    build: 'slim',
    skin: '#e7b58d',
    hair: '#4a2d1b',
    eye: '#b98543',
    primary: '#20262f',
    secondary: '#ece3d3',
    accent: '#b27a34',
    metal: '#707882',
    weapon: 'sword',
    hairStyle: 'messy',
    coat: true,
  },
  hadori: {
    id: 'hadori',
    name: '하도리',
    stage: '프시케 제7기 1조장',
    height: 1.74,
    build: 'muscular',
    skin: '#c58e69',
    hair: '#141415',
    eye: '#596d72',
    primary: '#17181b',
    secondary: '#2a2b2f',
    accent: '#8a6c43',
    metal: '#4d5055',
    weapon: 'gauntlets',
    hairStyle: 'short',
    coat: false,
  },
  kazrin: {
    id: 'kazrin',
    name: '카즈린',
    stage: '프시케 제7기 3조장',
    height: 1.76,
    build: 'athletic',
    skin: '#e9c3a4',
    hair: '#e1ddd4',
    eye: '#7f9ca4',
    primary: '#15171b',
    secondary: '#eee8dc',
    accent: '#c5a45d',
    metal: '#a8aaad',
    weapon: 'spear',
    hairStyle: 'ponytail',
    coat: true,
  },
  lami: {
    id: 'lami', name: '라미', height: 1.78, build: 'athletic', skin: '#b47e68', hair: '#49325f',
    eye: '#9f7fc5', primary: '#17171c', secondary: '#32243f', accent: '#8b66b2', metal: '#5c5c68',
    weapon: 'gauntlets', hairStyle: 'ponytail', coat: true,
  },
  haechan: {
    id: 'haechan', name: '해찬', height: 1.85, build: 'athletic', skin: '#d1a17f', hair: '#171719',
    eye: '#6d7783', primary: '#161b22', secondary: '#e2ded2', accent: '#a47d42', metal: '#8b9097',
    weapon: 'sword', hairStyle: 'messy', coat: true,
  },
  jinhwon: {
    id: 'jinhwon', name: '진훤', height: 1.88, build: 'muscular', skin: '#9d694b', hair: '#211a17',
    eye: '#60564f', primary: '#211e1c', secondary: '#554738', accent: '#9c7949', metal: '#75644d',
    weapon: 'gauntlets', hairStyle: 'messy', coat: true,
  },
  maru: {
    id: 'maru', name: '마루', height: 1.78, build: 'slim', skin: '#d3a486', hair: '#1e1b1b',
    eye: '#84735e', primary: '#17191d', secondary: '#484440', accent: '#a38150', metal: '#6c6964',
    weapon: 'sword', hairStyle: 'messy', coat: true,
  },
  ann: {
    id: 'ann', name: '앤', height: 1.78, build: 'athletic', skin: '#d8a180', hair: '#7a2e27',
    eye: '#9c5a43', primary: '#231719', secondary: '#5a282b', accent: '#b66850', metal: '#77706b',
    weapon: 'spear', hairStyle: 'ponytail', coat: true,
  },
  garam: {
    id: 'garam', name: '가람', height: 1.84, build: 'slim', skin: '#d4af91', hair: '#dedbd2',
    eye: '#9d8ac2', primary: '#191a20', secondary: '#e0d8ca', accent: '#8b72a9', metal: '#8e8b90',
    weapon: 'spear', hairStyle: 'messy', coat: true,
  },
  'nabi-nia': {
    id: 'nabi-nia', name: '나비 / 니아', height: 1.77, build: 'athletic', skin: '#c98f72', hair: '#181617',
    eye: '#8d6358', primary: '#171518', secondary: '#3b3030', accent: '#af8758', metal: '#655c58',
    weapon: 'gauntlets', hairStyle: 'ponytail', coat: true,
  },
};

const paletteSets = [
  ['#1a1c22', '#ded6c9', '#a67a42', '#747982'],
  ['#221a1c', '#d8cec5', '#9f5f55', '#6f6864'],
  ['#17201f', '#d7d5ca', '#6f9582', '#737c78'],
  ['#1d1924', '#d9d1df', '#8c6ba4', '#716c78'],
  ['#222019', '#ded4bd', '#a38a55', '#776d56'],
];
const hairColors = ['#171719', '#3b271b', '#d7d1c5', '#6b352b', '#211b2a', '#a79d8b'];
const skinColors = ['#e2b18f', '#c98d6b', '#9a6547', '#d8a083', '#e7c1a4'];
const eyeColors = ['#7d95a1', '#9a744d', '#7d6a9a', '#7f8b65', '#a35f58'];

function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const spearUsers = new Set(['ann', 'garam', 'guillaume', 'kazrin', 'kain', 'bellatrice', 'boksonga', 'yeri', 'night']);
const gauntletUsers = new Set(['hadori', 'jinhwon', 'perseus', 'kitty', 'kampta', 'chasey', 'nabi-nia']);
const muscularUsers = new Set(['hadori', 'jinhwon', 'perseus', 'chasey', 'brigitte']);
const longHairUsers = new Set(['ann', 'garam', 'kazrin', 'lami', 'laila', 'moira', 'nabi-nia', 'rose', 'tena-elion', 'yeri']);

const characterConfigs = roster.map(([id, name]) => {
  if (explicitConfigs[id]) return { ...explicitConfigs[id], stage: stageById[id] ?? '라온제나 인물 아카이브' };
  const hash = stableHash(id);
  const palette = paletteSets[hash % paletteSets.length];
  return {
    id,
    name,
    stage: stageById[id] ?? '라온제나 인물 아카이브',
    height: 1.68 + ((hash >>> 3) % 22) / 100,
    build: muscularUsers.has(id) ? 'muscular' : (hash % 3 === 0 ? 'athletic' : 'slim'),
    skin: skinColors[(hash >>> 5) % skinColors.length],
    hair: hairColors[(hash >>> 7) % hairColors.length],
    eye: eyeColors[(hash >>> 9) % eyeColors.length],
    primary: palette[0],
    secondary: palette[1],
    accent: palette[2],
    metal: palette[3],
    weapon: spearUsers.has(id) ? 'spear' : gauntletUsers.has(id) ? 'gauntlets' : 'sword',
    hairStyle: longHairUsers.has(id) ? 'ponytail' : (hash % 2 ? 'messy' : 'short'),
    coat: hash % 4 !== 0,
  };
});

function hexToFactor(hex) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
    1,
  ];
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return vector.map((entry) => entry / length);
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function sphere(center, radius, latitudeSegments = 14, longitudeSegments = 20, scale = [1, 1, 1]) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let latitude = 0; latitude <= latitudeSegments; latitude += 1) {
    const theta = latitude * Math.PI / latitudeSegments;
    for (let longitude = 0; longitude <= longitudeSegments; longitude += 1) {
      const phi = longitude * Math.PI * 2 / longitudeSegments;
      const normal = [
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi),
      ];
      positions.push(
        center[0] + normal[0] * radius * scale[0],
        center[1] + normal[1] * radius * scale[1],
        center[2] + normal[2] * radius * scale[2],
      );
      normals.push(...normalize([
        normal[0] / scale[0],
        normal[1] / scale[1],
        normal[2] / scale[2],
      ]));
    }
  }
  const width = longitudeSegments + 1;
  for (let latitude = 0; latitude < latitudeSegments; latitude += 1) {
    for (let longitude = 0; longitude < longitudeSegments; longitude += 1) {
      const first = latitude * width + longitude;
      const second = first + width;
      indices.push(first, second, first + 1, second, second + 1, first + 1);
    }
  }
  return { positions, normals, indices };
}

function cylinderBetween(start, end, startRadius, endRadius = startRadius, segments = 16) {
  const positions = [];
  const normals = [];
  const indices = [];
  const axis = normalize([end[0] - start[0], end[1] - start[1], end[2] - start[2]]);
  const helper = Math.abs(axis[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
  const tangent = normalize(cross(axis, helper));
  const bitangent = normalize(cross(axis, tangent));

  for (let ring = 0; ring < 2; ring += 1) {
    const center = ring === 0 ? start : end;
    const radius = ring === 0 ? startRadius : endRadius;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment * Math.PI * 2 / segments;
      const radial = [
        tangent[0] * Math.cos(angle) + bitangent[0] * Math.sin(angle),
        tangent[1] * Math.cos(angle) + bitangent[1] * Math.sin(angle),
        tangent[2] * Math.cos(angle) + bitangent[2] * Math.sin(angle),
      ];
      positions.push(
        center[0] + radial[0] * radius,
        center[1] + radial[1] * radius,
        center[2] + radial[2] * radius,
      );
      normals.push(...radial);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(segment, segments + segment, next, next, segments + segment, segments + next);
  }

  for (const [center, reverse] of [[start, true], [end, false]]) {
    const centerIndex = positions.length / 3;
    positions.push(...center);
    normals.push(...axis.map((entry) => entry * (reverse ? -1 : 1)));
    const offset = reverse ? 0 : segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      if (reverse) indices.push(centerIndex, next, segment);
      else indices.push(centerIndex, offset + segment, offset + next);
    }
  }
  return { positions, normals, indices };
}

function box(center, size) {
  const half = size.map((entry) => entry / 2);
  const corners = [
    [-half[0], -half[1], -half[2]], [half[0], -half[1], -half[2]],
    [half[0], half[1], -half[2]], [-half[0], half[1], -half[2]],
    [-half[0], -half[1], half[2]], [half[0], -half[1], half[2]],
    [half[0], half[1], half[2]], [-half[0], half[1], half[2]],
  ].map(([x, y, z]) => [x + center[0], y + center[1], z + center[2]]);
  const faces = [
    [0, 1, 2, 3, [0, 0, -1]], [5, 4, 7, 6, [0, 0, 1]],
    [4, 0, 3, 7, [-1, 0, 0]], [1, 5, 6, 2, [1, 0, 0]],
    [3, 2, 6, 7, [0, 1, 0]], [4, 5, 1, 0, [0, -1, 0]],
  ];
  const positions = [];
  const normals = [];
  const indices = [];
  for (const face of faces) {
    const base = positions.length / 3;
    for (const corner of face.slice(0, 4)) {
      positions.push(...corners[corner]);
      normals.push(...face[4]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

class GlbBuilder {
  constructor(config) {
    this.config = config;
    this.bufferViews = [];
    this.accessors = [];
    this.meshes = [];
    this.nodes = [];
    this.materials = [];
    this.binaryParts = [];
    this.byteLength = 0;
  }

  addMaterial(name, color, options = {}) {
    const material = {
      name,
      pbrMetallicRoughness: {
        baseColorFactor: hexToFactor(color),
        metallicFactor: options.metallic ?? 0,
        roughnessFactor: options.roughness ?? .82,
      },
      doubleSided: options.doubleSided ?? false,
      alphaMode: options.alphaMode ?? 'OPAQUE',
      extras: {
        raonjenaShader: options.shader ?? 'cel-pbr',
        outlineWidth: options.outlineWidth ?? .008,
      },
    };
    if (options.emissive) material.emissiveFactor = hexToFactor(options.emissive).slice(0, 3);
    this.materials.push(material);
    return this.materials.length - 1;
  }

  addTypedArray(array, componentType, type, target) {
    const alignment = (4 - (this.byteLength % 4)) % 4;
    if (alignment) {
      this.binaryParts.push(Buffer.alloc(alignment));
      this.byteLength += alignment;
    }
    const buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const byteOffset = this.byteLength;
    this.binaryParts.push(buffer);
    this.byteLength += buffer.length;
    const bufferView = this.bufferViews.length;
    this.bufferViews.push({ buffer: 0, byteOffset, byteLength: buffer.length, target });

    const componentCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const count = array.length / componentCount;
    const accessor = { bufferView, componentType, count, type };
    if (type === 'VEC3' && componentType === 5126) {
      accessor.min = [Infinity, Infinity, Infinity];
      accessor.max = [-Infinity, -Infinity, -Infinity];
      for (let index = 0; index < array.length; index += 3) {
        for (let axis = 0; axis < 3; axis += 1) {
          accessor.min[axis] = Math.min(accessor.min[axis], array[index + axis]);
          accessor.max[axis] = Math.max(accessor.max[axis], array[index + axis]);
        }
      }
    }
    this.accessors.push(accessor);
    return this.accessors.length - 1;
  }

  addPart(name, geometry, material, extras = {}) {
    const positionAccessor = this.addTypedArray(new Float32Array(geometry.positions), 5126, 'VEC3', 34962);
    const normalAccessor = this.addTypedArray(new Float32Array(geometry.normals), 5126, 'VEC3', 34962);
    const maxIndex = Math.max(...geometry.indices);
    const IndexArray = maxIndex > 65535 ? Uint32Array : Uint16Array;
    const indexAccessor = this.addTypedArray(
      new IndexArray(geometry.indices),
      maxIndex > 65535 ? 5125 : 5123,
      'SCALAR',
      34963,
    );
    const meshIndex = this.meshes.length;
    this.meshes.push({
      name,
      primitives: [{
        attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
        indices: indexAccessor,
        material,
      }],
      extras,
    });
    this.nodes.push({ name, mesh: meshIndex, extras });
    return this.nodes.length - 1;
  }

  async write(filePath) {
    const binary = Buffer.concat(this.binaryParts);
    const gltf = {
      asset: {
        version: '2.0',
        generator: 'Raonjena Procedural Character Forge 1.0',
        copyright: 'Raonjena project asset',
        extras: {
          characterId: this.config.id,
          characterName: this.config.name,
          productionTier: 'procedural-maquette',
          source: 'authored-code',
        },
      },
      scene: 0,
      scenes: [{ name: `${this.config.name} Showcase`, nodes: this.nodes.map((_, index) => index) }],
      nodes: this.nodes,
      meshes: this.meshes,
      materials: this.materials,
      buffers: [{ byteLength: binary.length }],
      bufferViews: this.bufferViews,
      accessors: this.accessors,
      extras: {
        unitScale: 'meter',
        upAxis: 'Y',
        frontAxis: '-Z',
        rigStatus: 'maquette-skeleton-pending',
        intendedShader: 'cel-pbr-outline',
      },
    };

    let jsonBuffer = Buffer.from(JSON.stringify(gltf), 'utf8');
    const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
    if (jsonPadding) jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);
    const binaryPadding = (4 - (binary.length % 4)) % 4;
    const paddedBinary = binaryPadding ? Buffer.concat([binary, Buffer.alloc(binaryPadding)]) : binary;
    const totalLength = 12 + 8 + jsonBuffer.length + 8 + paddedBinary.length;
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(totalLength, 8);
    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
    jsonHeader.writeUInt32LE(0x4e4f534a, 4);
    const binaryHeader = Buffer.alloc(8);
    binaryHeader.writeUInt32LE(paddedBinary.length, 0);
    binaryHeader.writeUInt32LE(0x004e4942, 4);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.concat([header, jsonHeader, jsonBuffer, binaryHeader, paddedBinary]));

    return {
      filePath,
      bytes: totalLength,
      meshes: this.meshes.length,
      materials: this.materials.length,
      nodes: this.nodes.length,
      triangles: this.meshes.reduce(
        (sum, mesh) => sum + mesh.primitives.reduce(
          (primitiveSum, primitive) => primitiveSum + this.accessors[primitive.indices].count / 3,
          0,
        ),
        0,
      ),
    };
  }
}

function buildCharacter(config) {
  const builder = new GlbBuilder(config);
  const materials = {
    skin: builder.addMaterial('MAT_Skin', config.skin, { roughness: .9 }),
    hair: builder.addMaterial('MAT_Hair', config.hair, { roughness: .72, doubleSided: true }),
    eye: builder.addMaterial('MAT_Eye', config.eye, { roughness: .28, emissive: config.eye }),
    dark: builder.addMaterial('MAT_Primary', config.primary, { roughness: .74 }),
    light: builder.addMaterial('MAT_Secondary', config.secondary, { roughness: .88 }),
    accent: builder.addMaterial('MAT_Accent', config.accent, { metallic: .35, roughness: .42 }),
    metal: builder.addMaterial('MAT_Metal', config.metal, { metallic: .84, roughness: .28 }),
  };

  const muscular = config.build === 'muscular';
  const heightScale = config.height / 1.78;
  const shoulder = (muscular ? .42 : .34) * heightScale;
  const torsoTop = 1.48 * heightScale;
  const torsoBottom = .89 * heightScale;
  const headCenter = [0, 1.68 * heightScale, 0];

  builder.addPart('Body_Head', sphere(headCenter, .16 * heightScale, 18, 24, [.88, 1.04, .9]), materials.skin, { slot: 'head' });
  builder.addPart('Body_Neck', cylinderBetween(
    [0, 1.48 * heightScale, 0],
    [0, 1.56 * heightScale, 0],
    .07 * heightScale,
  ), materials.skin, { slot: 'neck' });
  builder.addPart('Outfit_Torso', cylinderBetween(
    [0, torsoBottom, 0],
    [0, torsoTop, 0],
    (muscular ? .29 : .23) * heightScale,
    shoulder,
    22,
  ), materials.dark, { slot: 'torso', cloth: true });
  builder.addPart('Outfit_Waist', cylinderBetween(
    [0, .82 * heightScale, 0],
    [0, .92 * heightScale, 0],
    .22 * heightScale,
    .24 * heightScale,
    20,
  ), materials.accent, { slot: 'belt' });

  const eyeY = 1.7 * heightScale;
  for (const side of [-1, 1]) {
    builder.addPart(`Face_Eye_${side < 0 ? 'L' : 'R'}`, sphere(
      [side * .058 * heightScale, eyeY, -.139 * heightScale],
      .034 * heightScale,
      10,
      14,
      [1, .72, .34],
    ), materials.light, { slot: 'eye-white' });
    builder.addPart(`Face_Iris_${side < 0 ? 'L' : 'R'}`, sphere(
      [side * .058 * heightScale, eyeY, -.158 * heightScale],
      .018 * heightScale,
      9,
      12,
      [.82, 1.15, .3],
    ), materials.eye, { slot: 'iris' });
  }

  const hipY = .82 * heightScale;
  const kneeY = .44 * heightScale;
  const ankleY = .08 * heightScale;
  for (const side of [-1, 1]) {
    const sideName = side < 0 ? 'L' : 'R';
    const legX = side * .115 * heightScale;
    builder.addPart(`Body_Thigh_${sideName}`, cylinderBetween(
      [legX, hipY, 0],
      [legX * 1.05, kneeY, .01],
      .105 * heightScale,
      .086 * heightScale,
      18,
    ), materials.dark, { slot: 'leg-upper' });
    builder.addPart(`Body_Shin_${sideName}`, cylinderBetween(
      [legX * 1.05, kneeY, .01],
      [legX, ankleY, -.01],
      .081 * heightScale,
      .058 * heightScale,
      18,
    ), materials.dark, { slot: 'leg-lower' });
    builder.addPart(`Outfit_Boot_${sideName}`, box(
      [legX, .055 * heightScale, -.035 * heightScale],
      [.14 * heightScale, .16 * heightScale, .24 * heightScale],
    ), materials.metal, { slot: 'boot' });

    const shoulderPoint = [side * shoulder * .94, 1.4 * heightScale, 0];
    const elbow = [side * (muscular ? .5 : .43) * heightScale, 1.12 * heightScale, .015];
    const wrist = [side * (muscular ? .53 : .46) * heightScale, .86 * heightScale, -.025];
    builder.addPart(`Body_UpperArm_${sideName}`, cylinderBetween(
      shoulderPoint,
      elbow,
      (muscular ? .12 : .085) * heightScale,
      (muscular ? .105 : .072) * heightScale,
      18,
    ), materials.dark, { slot: 'arm-upper' });
    builder.addPart(`Body_Forearm_${sideName}`, cylinderBetween(
      elbow,
      wrist,
      (muscular ? .105 : .073) * heightScale,
      .055 * heightScale,
      18,
    ), materials.skin, { slot: 'arm-lower' });
    builder.addPart(`Outfit_Glove_${sideName}`, sphere(
      [wrist[0], wrist[1] - .035 * heightScale, wrist[2] - .01],
      .064 * heightScale,
      10,
      14,
      [1, 1.1, .75],
    ), config.weapon === 'gauntlets' ? materials.metal : materials.dark, { slot: 'hand' });
  }

  builder.addPart('Hair_Cap', sphere(
    [0, 1.735 * heightScale, .018],
    .168 * heightScale,
    16,
    24,
    [1.02, .92, 1.01],
  ), materials.hair, { slot: 'hair-main' });

  const strandCount = config.hairStyle === 'short' ? 10 : 16;
  for (let index = 0; index < strandCount; index += 1) {
    const angle = index * Math.PI * 2 / strandCount;
    const frontBias = Math.sin(angle) < 0 ? -.035 : 0;
    const strandLength = config.hairStyle === 'messy' ? .13 + (index % 3) * .025 : .1;
    const start = [
      Math.cos(angle) * .13 * heightScale,
      1.76 * heightScale + Math.sin(index * 2.3) * .025,
      Math.sin(angle) * .13 * heightScale + frontBias,
    ];
    const end = [
      Math.cos(angle) * (.12 + Math.sin(index) * .025) * heightScale,
      (1.76 - strandLength) * heightScale,
      Math.sin(angle) * .14 * heightScale - .005,
    ];
    builder.addPart(`Hair_Strand_${String(index).padStart(2, '0')}`, cylinderBetween(
      start,
      end,
      .035 * heightScale,
      .008 * heightScale,
      10,
    ), materials.hair, { slot: 'hair-strand' });
  }

  if (config.hairStyle === 'ponytail') {
    const ponyPoints = [
      [0, 1.74 * heightScale, .13],
      [0, 1.58 * heightScale, .25],
      [.03, 1.36 * heightScale, .28],
      [-.02, 1.1 * heightScale, .24],
    ];
    for (let index = 0; index < ponyPoints.length - 1; index += 1) {
      builder.addPart(`Hair_Ponytail_${index}`, cylinderBetween(
        ponyPoints[index],
        ponyPoints[index + 1],
        (.07 - index * .012) * heightScale,
        (.058 - index * .014) * heightScale,
        14,
      ), materials.hair, { slot: 'hair-ponytail' });
    }
  }

  if (config.coat) {
    builder.addPart('Outfit_CoatTail_L', box(
      [-.16 * heightScale, .75 * heightScale, .055],
      [.23 * heightScale, .65 * heightScale, .035],
    ), materials.dark, { slot: 'coat-tail', cloth: true });
    builder.addPart('Outfit_CoatTail_R', box(
      [.16 * heightScale, .75 * heightScale, .055],
      [.23 * heightScale, .65 * heightScale, .035],
    ), materials.light, { slot: 'coat-tail', cloth: true });
  }

  if (config.weapon === 'sword') {
    builder.addPart('Weapon_SwordBlade', box(
      [.58 * heightScale, .73 * heightScale, 0],
      [.045 * heightScale, .78 * heightScale, .018],
    ), materials.metal, { slot: 'weapon', weapon: 'longsword' });
    builder.addPart('Weapon_SwordGuard', box(
      [.58 * heightScale, 1.1 * heightScale, 0],
      [.19 * heightScale, .035 * heightScale, .045],
    ), materials.accent, { slot: 'weapon-guard' });
  } else if (config.weapon === 'spear') {
    builder.addPart('Weapon_SpearShaft', cylinderBetween(
      [.58 * heightScale, .15 * heightScale, 0],
      [.58 * heightScale, 1.82 * heightScale, 0],
      .018 * heightScale,
      .018 * heightScale,
      12,
    ), materials.accent, { slot: 'weapon', weapon: 'spear' });
    builder.addPart('Weapon_SpearHead', cylinderBetween(
      [.58 * heightScale, 1.8 * heightScale, 0],
      [.58 * heightScale, 2.05 * heightScale, 0],
      .07 * heightScale,
      0,
      12,
    ), materials.metal, { slot: 'weapon-head' });
  } else {
    for (const side of [-1, 1]) {
      builder.addPart(`Weapon_Gauntlet_${side < 0 ? 'L' : 'R'}`, box(
        [side * .53 * heightScale, .82 * heightScale, -.015],
        [.17 * heightScale, .24 * heightScale, .16 * heightScale],
      ), materials.metal, { slot: 'weapon', weapon: 'gauntlet' });
    }
  }

  return builder;
}

const results = [];
for (const config of characterConfigs) {
  const filePath = path.join(outputRoot, config.id, `${config.id}-procedural-v1.glb`);
  const result = await buildCharacter(config).write(filePath);
  results.push({
    id: `${config.id}-procedural-v1`,
    characterId: config.id,
    characterName: config.name,
    stage: config.stage,
    runtimePath: `/models/characters/${config.id}/${config.id}-procedural-v1.glb`,
    thumbnail: `/art/characters/${config.id}/03-candidate.webp`,
    sourceSheet: ['raon', 'hadori', 'kazrin'].includes(config.id)
      ? `/art/archive/${config.id}-sheet.webp`
      : `/art/characters/${config.id}/01-origin.webp`,
    variationCount: 20,
    status: 'prototype',
    productionTier: 'procedural-maquette',
    generator: 'tools/3d/generate-procedural-glb.mjs',
    intendedUpgrade: 'Blender authored LOD0 with rig, expressions and animation set',
    ...result,
    filePath: undefined,
  });
}

await mkdir(path.dirname(catalogPath), { recursive: true });
await writeFile(catalogPath, `${JSON.stringify({
  schema: 'raonjena.model-runtime-catalog',
  version: 1,
  generatedAt: new Date().toISOString(),
  models: results,
}, null, 2)}\n`, 'utf8');

console.log(`generated ${results.length} GLB models`);
for (const result of results) {
  console.log(`${result.characterId}: ${result.meshes} meshes, ${Math.round(result.triangles)} triangles, ${result.bytes} bytes`);
}
