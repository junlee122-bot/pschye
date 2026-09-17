import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['.tmp/tactical-state-audit.ts'], testTimeout: 120000 } });
