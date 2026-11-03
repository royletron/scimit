import { useSyncExternalStore } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

// Tiny module-level toast store: call toast.success()/toast.error() from anywhere, render <Toaster /> once.
type Toast = { id: number; tone: 'success' | 'error'; title: string; detail?: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(tone: Toast['tone'], title: string, detail?: string) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, tone, title, detail }];
  emit();
  setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 3500);
}

export const toast = {
  success: (title: string, detail?: string) => push('success', title, detail),
  error: (title: string, detail?: string) => push('error', title, detail),
};

/** Best-effort message from an API/SCIM error */
export const errorText = (e: any) => e?.detail || e?.message || 'Something went wrong. Check that the SCIMit server is running.';

export function Toaster() {
  const items = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => toasts,
  );

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-[min(24rem,calc(100vw-2.5rem))]" aria-live="polite" role="status">
      {items.map((t) => (
        <div key={t.id} className="toast-in flex items-start gap-3 rounded-lg bg-code text-[#eef0f3] ring-1 ring-white/10 pl-3.5 pr-2 py-3 shadow-[0_8px_24px_-8px_rgb(26_29_36/0.45)]">
          {t.tone === 'success'
            ? <CircleCheck size={18} className="shrink-0 mt-px text-[#7fd3a0]" aria-hidden />
            : <CircleAlert size={18} className="shrink-0 mt-px text-[#ff9b90]" aria-hidden />}
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-medium leading-snug">{t.title}</p>
            {t.detail && <p className="mt-0.5 text-[12.5px] leading-snug text-[#c4c8d0] break-words">{t.detail}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="shrink-0 grid place-items-center h-6 w-6 rounded text-[#c4c8d0] hover:text-white hover:bg-white/10" aria-label="Dismiss">
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
