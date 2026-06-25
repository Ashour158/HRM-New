import * as React from 'react';

export function useFormError() {
  const [error, setError] = React.useState<string | null>(null);
  return {
    error,
    setError,
    clearError: React.useCallback(() => setError(null), []),
  };
}
