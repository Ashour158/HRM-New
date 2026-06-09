function normalizedPath(id: string) {
  return id.replace(/\\/g, '/');
}

function packageNameFromId(id: string) {
  const normalized = normalizedPath(id);
  const marker = '/node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index === -1) return undefined;

  const packagePath = normalized.slice(index + marker.length);
  const parts = packagePath.split('/');

  if (parts[0]?.startsWith('@')) {
    return parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0];
  }

  return parts[0];
}

export function manualChunkForId(id: string) {
  if (!normalizedPath(id).includes('/node_modules/')) return undefined;

  const packageName = packageNameFromId(id);

  if (!packageName) return 'vendor';

  if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler' || packageName === 'use-sync-external-store') {
    return 'vendor-react';
  }

  if (packageName === 'react-router-dom' || packageName === 'react-router' || packageName === '@remix-run/router') {
    return 'vendor-router';
  }

  if (packageName.startsWith('@radix-ui/')) return 'vendor-radix';
  if (packageName.startsWith('@tanstack/')) return 'vendor-query';
  if (packageName === 'lucide-react') return 'vendor-icons';

  if (
    packageName === 'recharts' ||
    packageName.startsWith('d3-') ||
    packageName === 'victory-vendor' ||
    packageName === 'decimal.js-light'
  ) {
    return 'vendor-charts';
  }

  if (packageName === 'axios' || packageName === 'zod' || packageName === 'zustand') return 'vendor-platform';
  if (packageName === 'clsx' || packageName === 'tailwind-merge' || packageName === 'class-variance-authority') return 'vendor-ui';

  return 'vendor';
}
