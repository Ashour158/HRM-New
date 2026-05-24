
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose } from './toast';
import { useUIStore } from '@/stores/ui-store';

/**
 * Global toast notification container.
 * Displays and manages toast notifications from the UI store.
 */
export function Toaster() {
  const { notifications, dismissNotification } = useUIStore();

  const toasts = notifications.slice(0, 5);

  return (
    <ToastProvider>
      {toasts.map((notification) => (
        <Toast
          key={notification.id}
          variant={notification.type === 'error' ? 'destructive' : 'default'}
          onOpenChange={(open) => {
            if (!open) dismissNotification(notification.id);
          }}
        >
          <div className="grid gap-1">
            <ToastTitle>{notification.title}</ToastTitle>
            {notification.message && <ToastDescription>{notification.message}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
