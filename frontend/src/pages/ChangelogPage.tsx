import { useEffect } from 'react';
import { PageHeader, Badge } from '../components/common/ui';
import { releases, latestVersion, useWhatsNew } from '../hooks/useWhatsNew';

const SECTION_TONE: Record<string, 'ok' | 'warn' | 'err' | 'neutral'> = {
  Added: 'ok',
  Fixed: 'warn',
  Removed: 'err',
  Security: 'err',
};

// `code` spans in changelog text
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="font-mono text-[12.5px] bg-chalk text-ink rounded px-1 py-px">{part.slice(1, -1)}</code>
        ) : (
          part
        )
      )}
    </>
  );
}

const formatDate = (d?: string) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function ChangelogPage() {
  const { markSeen } = useWhatsNew();
  useEffect(markSeen, [markSeen]);

  return (
    <div>
      <PageHeader
        title="What’s new"
        meta={latestVersion && `v${latestVersion}`}
        description="Every SCIMit release, newest first."
      />
      <ol className="page-pad">
        {releases.map((r, i) => (
          <li key={r.version} className="grid gap-x-10 gap-y-3 md:grid-cols-[9rem_minmax(0,1fr)] py-8 border-t border-line first:border-t-0 first:pt-2">
            <div className="md:sticky md:top-6 self-start">
              <h2 className="font-mono text-[17px] font-semibold text-ink">{r.version}</h2>
              <p className="mt-0.5 text-[13px] text-graphite">{formatDate(r.date)}</p>
              {i === 0 && <div className="mt-2"><Badge tone="ok">Latest</Badge></div>}
            </div>
            <div className="space-y-5 max-w-[72ch]">
              {r.sections.map((s) => (
                <section key={s.title}>
                  <h3 className="mb-2"><Badge tone={SECTION_TONE[s.title] ?? 'neutral'}>{s.title}</Badge></h3>
                  <ul className="space-y-1.5">
                    {s.items.map((item, j) => (
                      <li key={j} className="relative pl-4 text-[14px] leading-relaxed text-ink before:absolute before:left-0 before:top-[0.7em] before:h-1 before:w-1 before:rounded-full before:bg-mute">
                        <Inline text={item} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
