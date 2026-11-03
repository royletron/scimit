import { useState } from 'react';
import { RequestLog } from '../../types/scim';
import { useTargets } from '../../hooks/usePlayback';
import { LogDetail, queryString } from '../logs/LogList';
import { DirectionTag, MethodTag, PathText, StatusTag, formatTime, railClass } from './ui';

// Compact timeline of the requests that touched one user or group
export function ActivityLogs({ logs, isLoading }: { logs: RequestLog[]; isLoading: boolean }) {
  const { data: targets } = useTargets();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) return <p className="page-pad hint">Loading activity…</p>;
  if (logs.length === 0) return <p className="page-pad hint">No requests have touched this resource yet.</p>;

  return (
    <ol className="bg-paper border-y border-line divide-y divide-line">
      {logs.map((log) => {
        const open = expandedId === log.id;
        return (
          <li key={log.id} className={railClass(log.direction)}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setExpandedId(open ? null : log.id)}
              className="w-full grid grid-cols-[auto_1fr_auto] md:grid-cols-[8.5rem_13rem_1fr_auto_4rem] items-center gap-3 px-[var(--page-x)] py-2 text-left hover:bg-chalk/70 transition-colors"
            >
              <span className="max-md:hidden text-xs text-graphite">{formatTime(log.timestamp)}</span>
              <DirectionTag direction={log.direction} target={targets?.find((t) => t.id === log.target_id)?.name} />
              <span className="flex items-baseline gap-2 min-w-0">
                <MethodTag method={log.method} />
                <PathText path={log.path} query={queryString(log.query_params)} className="text-xs" />
              </span>
              <StatusTag code={log.status_code} />
              <span className="max-md:hidden text-right font-mono text-[11px] text-mute">{log.duration_ms} ms</span>
            </button>
            {open && (
              <div className="px-[var(--page-x)] pb-4 pt-1 bg-chalk/50">
                <LogDetail log={log} replay={false} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
