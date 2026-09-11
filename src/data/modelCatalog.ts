export type ModelStatus = 'prototype' | 'review' | 'production';

export interface RuntimeModelRecord {
  id: string;
  characterId: string;
  characterName: string;
  stage: string;
  runtimePath: string;
  thumbnail: string;
  sourceSheet: string;
  status: ModelStatus;
  productionTier: string;
  generator: string;
  intendedUpgrade: string;
  bytes: number;
  meshes: number;
  materials: number;
  nodes: number;
  triangles: number;
  variationCount: number;
  providerTaskId?: string;
  providerCoverUrl?: string;
  sourceViews?: string[];
  lodFiles?: string[];
  blenderPilot?: {
    version: string;
    bones: number;
    animations: number;
    animationNames?: string[];
    lodTriangles: number[];
    blendSource: string;
  };
  productionAsset?: {
    retopology: string;
    manualRetopology: boolean;
    quadRatio: number;
    hairCards: number;
    textureResolution: number;
    textureChannels: string[];
    shapeKeys: number;
    bones: number;
    animations: number;
    lodTriangles: number[];
    unityCompatibility: 'pass' | 'fail';
    actualUnityEditorValidation: boolean;
    validationReport: string;
  };
  qualityGate?: {
    status: 'passed' | 'failed';
    tier: string;
    checks: {
      minimumBytes: number;
      triangleRange: [number, number];
      requiresMesh: boolean;
      requiresMaterial: boolean;
      requiresNode: boolean;
    };
  };
}

export interface RuntimeModelCatalog {
  schema: string;
  version: number;
  generatedAt: string | null;
  models: RuntimeModelRecord[];
}

export interface CharacterFidelityResult {
  characterId: string;
  characterName: string;
  runtimePath: string;
  score: number;
  tier: 'blocked' | 'maquette' | 'verticalSlice' | 'heroProduction';
  blockers: string[];
  metrics: {
    triangles: number;
    materials: number;
    skins: number;
    morphTargets: number;
    animations: number;
    lodLevels: number;
  } | null;
}

export interface CharacterFidelityReport {
  generatedAt: string;
  summary: {
    total: number;
    blocked: number;
    maquette: number;
    verticalSlice: number;
    heroProduction: number;
    averageScore: number;
  };
  results: CharacterFidelityResult[];
}

export async function loadRuntimeModelCatalog(signal?: AbortSignal) {
  const response = await fetch('/data/model-runtime-catalog.json', { signal });
  if (!response.ok) {
    throw new Error(`3D 모델 카탈로그를 불러오지 못했습니다. (${response.status})`);
  }
  const catalog = await response.json() as RuntimeModelCatalog;
  const overrideResponse = await fetch('/data/model-provider-overrides.json', { signal });
  if (!overrideResponse.ok) return catalog;

  const overrides = await overrideResponse.json() as RuntimeModelCatalog;
  if (!overrides.models?.length) return catalog;
  const overrideByCharacter = new Map(
    overrides.models.map((model) => [model.characterId, model]),
  );
  const models = catalog.models.map((model) => ({
    ...model,
    ...overrideByCharacter.get(model.characterId),
  }));
  for (const model of overrides.models) {
    if (!catalog.models.some((base) => base.characterId === model.characterId)) {
      models.push(model);
    }
  }
  return {
    ...catalog,
    generatedAt: overrides.generatedAt || catalog.generatedAt,
    models,
  };
}

export async function loadCharacterFidelityReport(signal?: AbortSignal) {
  const response = await fetch('/data/character-fidelity-report.json', { signal });
  if (!response.ok) throw new Error(`캐릭터 피델리티 보고서를 불러오지 못했습니다. (${response.status})`);
  return response.json() as Promise<CharacterFidelityReport>;
}
