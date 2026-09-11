export type AssetQualityStatus = 'pass' | 'warn' | 'fail';

export interface AssetQualityGate {
  id: string;
  status: AssetQualityStatus;
  label: string;
}

export interface AssetCatalogEntry {
  id: string;
  category: string;
  collection: string;
  title: string;
  variant: string;
  runtimePath: string;
  shipped: boolean;
  representation: string;
  provenance: string;
  sourceRecordId: string | null;
  originalSource: string | null;
  bytes: number;
  sha256: string;
  width: number | null;
  height: number | null;
  alpha: boolean | null;
  duplicateCount: number;
  staticallyReferenced: boolean;
  referenceOwners: string[];
  quality: {
    score: number;
    status: AssetQualityStatus;
    gates: AssetQualityGate[];
  };
}

export interface AssetCatalogReport {
  schema: string;
  version: number;
  generatedAt: string;
  summary: {
    shipped: number;
    declared: number;
    missingDeclared: number;
    sourceManifestRecords: number;
    staticallyReferenced: number;
    totalBytes: number;
    provenance: Record<string, number>;
    categories: Record<string, number>;
    quality: Record<AssetQualityStatus, number>;
  };
  entries: AssetCatalogEntry[];
}

export const assetCategoryLabels: Record<string, string> = {
  all: '전체 자산',
  archive: '원본 설정화',
  character: '인물 바리에이션',
  location: '장소 콘셉트',
  mission: '작전 미술',
  portraits: '전투 초상',
  story: '스토리 장면',
  village: '첫 마을',
};

export const assetQualityLabels: Record<'all' | AssetQualityStatus, string> = {
  all: '모든 상태',
  pass: '통과',
  warn: '검토 필요',
  fail: '교체 권장',
};

export function formatAssetBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function formatAssetProvenance(provenance: string) {
  const labels: Record<string, string> = {
    'provided-reference': '제공 원본',
    'generated-character-2d': '생성 캐릭터 2D',
    'generated-level-2d': '생성 레벨 2D',
    'generated-story-2d': '생성 스토리 2D',
    'generated-world-2d': '생성 월드 2D',
    'generated-archive-2d': '생성 기록 2D',
    'generated-2d': '생성 2D',
    'project-asset': '프로젝트 자산',
  };
  return labels[provenance] ?? provenance;
}
