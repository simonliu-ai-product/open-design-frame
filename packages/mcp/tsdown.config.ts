import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', stdio: 'src/stdio.ts' },
  format: 'esm',
  target: 'node18',
  platform: 'node',
  clean: true,
  dts: true,
  shims: false,
  external: ['@open-design-frame/core'],
});
