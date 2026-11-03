import { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, LucideIcon } from 'lucide-react';

// ─── Page header ─────────────────────────────────────────────────────────────

export function PageHeader({ title, meta, description, actions }: {
  title: string;
  meta?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-pad flex flex-wrap items-start justify-between gap-4 mb-7">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.015em] text-ink">
          {title}
          {meta !== undefined && <span className="ml-3 text-[15px] font-normal tracking-normal text-mute">{meta}</span>}
        </h1>
        {description && <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-graphite">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 pt-0.5">{actions}</div>}
    </header>
  );
}

// ─── HTTP tags ───────────────────────────────────────────────────────────────

export function MethodTag({ method }: { method: string }) {
  return (
    <span className={`font-mono text-xs font-semibold tracking-wide ${method === 'DELETE' ? 'text-err' : 'text-ink'}`}>
      {method}
    </span>
  );
}

export function statusTone(code: number) {
  if (!code) return 'err';
  if (code < 300) return 'ok';
  if (code < 400) return 'warn';
  return 'err';
}

const TONE = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  err: 'bg-err-soft text-err',
  neutral: 'bg-line text-graphite',
} as const;

export function StatusTag({ code }: { code: number }) {
  return (
    <span className={`inline-flex w-fit items-center h-5 px-1.5 rounded font-mono text-xs font-semibold ${TONE[statusTone(code)]}`}>
      {code || 'no response'}
    </span>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONE; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-xs font-medium ${TONE[tone]}`}>
      {children}
    </span>
  );
}

// ─── Direction: the one place colour means "where did this go" ───────────────

export function DirectionTag({ direction, target }: { direction?: string; target?: string }) {
  const out = direction === 'outbound';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${out ? 'text-disco' : 'text-lagoon'}`}>
      {out ? <ArrowUpRight size={14} strokeWidth={2} aria-hidden /> : <ArrowDownLeft size={14} strokeWidth={2} aria-hidden />}
      <span className="max-md:sr-only">{out ? `Sent${target ? ` to ${target}` : ''}` : 'Received'}</span>
    </span>
  );
}

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/** Request path in mono, decoded, with the query string dimmed. Wraps on small screens instead of hiding the status column. */
export function PathText({ path, query, className = '' }: { path: string; query?: string; className?: string }) {
  const [p, q = ''] = safeDecode(path).split(/\?(.*)/s);
  const qs = q ? `?${q}` : query ?? '';
  return (
    <span className={`font-mono text-ink md:truncate max-md:break-all ${className}`}>
      {p}{qs && <span className="text-graphite">{qs}</span>}
    </span>
  );
}

export const railClass = (direction?: string) =>
  direction === 'outbound' ? 'shadow-[inset_3px_0_0_var(--color-disco)]' : 'shadow-[inset_3px_0_0_var(--color-lagoon)]';

// ─── Tabs ────────────────────────────────────────────────────────────────────

export function Tabs<T extends string>({ tabs, value, onChange, inset }: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  /** Full-width strip with labels aligned to the page gutter (for expanded table rows) */
  inset?: boolean;
}) {
  return (
    <div className={`tabs mb-4 ${inset ? 'page-pad' : ''}`} role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className="tab" onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── States ──────────────────────────────────────────────────────────────────

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-16 justify-center text-[13px] text-graphite" role="status">
      <span className="h-3.5 w-3.5 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="py-16 text-center" role="alert">
      <p className="text-sm font-medium text-err">{title}</p>
      {detail && <p className="mt-1 text-[13px] text-graphite">{detail}</p>}
    </div>
  );
}

export function EmptyState({ title, children, action, icon: Icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="py-16 px-6 text-center border border-dashed border-line-strong rounded-lg">
      {Icon && (
        <span className="mx-auto mb-4 grid place-items-center h-11 w-11 rounded-full bg-chalk text-graphite">
          <Icon size={20} strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {children && <div className="mt-1.5 mx-auto max-w-[52ch] text-[13px] leading-relaxed text-graphite">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-medium text-graphite mb-1.5">{children}</p>;
}

export const formatTime = (ts: string) =>
  new Date(ts.includes('T') || ts.endsWith('Z') ? ts : ts.replace(' ', 'T') + 'Z').toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
