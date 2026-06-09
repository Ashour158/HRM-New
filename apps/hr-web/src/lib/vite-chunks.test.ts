import { describe, expect, it } from 'vitest';
import { manualChunkForId } from './vite-chunks';

describe('manualChunkForId', () => {
  it('keeps package chunks specific before generic react matching', () => {
    expect(manualChunkForId('D:/repo/node_modules/.pnpm/react@18/node_modules/react/index.js')).toBe('vendor-react');
    expect(manualChunkForId('D:/repo/node_modules/.pnpm/react-dom@18/node_modules/react-dom/index.js')).toBe('vendor-react');
    expect(manualChunkForId('D:/repo/node_modules/.pnpm/@radix-ui+react-dialog/node_modules/@radix-ui/react-dialog/dist/index.js')).toBe('vendor-radix');
    expect(manualChunkForId('D:/repo/node_modules/.pnpm/lucide-react@0.294.0/node_modules/lucide-react/dist/esm/index.js')).toBe('vendor-icons');
    expect(manualChunkForId('D:/repo/node_modules/.pnpm/recharts@3.8.1/node_modules/recharts/es6/index.js')).toBe('vendor-charts');
    expect(manualChunkForId('D:/repo/src/pages/admin/reporting.tsx')).toBeUndefined();
  });
});
