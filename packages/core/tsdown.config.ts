import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/vite/index.ts', 'src/ops/index.ts', 'src/cli/bin.ts'],
  format: 'esm',
  dts: true,
  clean: true,
});
