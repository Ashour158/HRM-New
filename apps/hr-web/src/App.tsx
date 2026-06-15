import { AppRoutes } from '@/routes';
import { useAuth } from '@/hooks/use-auth';
import { Toaster } from '@/components/ui/toast-provider';
import { useTranslation } from 'react-i18next';

/**
 * Root application component.
 * Initializes authentication and renders the application routes.
 * Includes toast notification system globally.
 */
export function App() {
  const { isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t('app.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppRoutes />
      <Toaster />
    </>
  );
}
