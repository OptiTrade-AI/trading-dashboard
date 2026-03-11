'use client';

import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

const icons: Record<string, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
};

const styles: Record<string, string> = {
  success: 'border-profit/30 bg-profit/10 text-profit',
  error: 'border-loss/30 bg-loss/10 text-loss',
  info: 'border-accent/30 bg-accent/10 text-accent',
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-lg shadow-black/20 animate-slide-in',
            styles[toast.type]
          )}
        >
          <span className="text-lg font-bold flex-shrink-0">{icons[toast.type]}</span>
          <span className="text-sm font-medium text-foreground flex-1">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="text-muted hover:text-foreground text-sm flex-shrink-0 ml-2"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
