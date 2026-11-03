import { useQuery } from '@tanstack/react-query';
import { RequestLog } from '../../types/scim';
import { adminApi } from '../../services/api';
import { Change, diffResources, resourceOf } from '../../lib/diff';

const ok = (l: RequestLog) => l.status_code >= 200 && l.status_code < 300;

/** Whether a log can have a Changes view: a successful update to a known resource */
export const hasChanges = (log: RequestLog) =>
  (log.method === 'PUT' || log.method === 'PATCH') && ok(log) && !!(log.user_id || log.group_id);

const fmt = (v: unknown) => JSON.stringify(v);
// Let long attribute paths wrap only between segments (after "." and "]"), never mid-name
const breakable = (path: string) => path.replace(/([.\]])/g, '$1\u200b');

const MARK = {
  added: { sign: '+', cls: 'text-ok', label: 'Added' },
  removed: { sign: '−', cls: 'text-err', label: 'Removed' },
  changed: { sign: '~', cls: 'text-warn', label: 'Changed' },
} as const;

function ChangeRow({ c }: { c: Change }) {
  const m = MARK[c.kind];
  return (
    <li className="grid grid-cols-[1.25rem_minmax(12rem,26rem)_1fr] gap-3 items-baseline py-1.5 font-mono text-[12.5px]">
      <span className={`${m.cls} font-semibold`} aria-label={m.label}>{m.sign}</span>
      <span className="text-ink break-words">{breakable(c.path)}</span>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {c.kind === 'changed' && (
          <>
            <span className="bg-err-soft text-err line-through decoration-err/50 rounded px-1">{fmt(c.before)}</span>
            <span className="text-mute mx-2" aria-hidden>→</span>
            <span className="bg-ok-soft text-ok rounded px-1">{fmt(c.after)}</span>
          </>
        )}
        {c.kind === 'added' && <span className="bg-ok-soft text-ok rounded px-1">{fmt(c.after)}</span>}
        {c.kind === 'removed' && <span className="bg-err-soft text-err line-through decoration-err/50 rounded px-1">{fmt(c.before)}</span>}
      </span>
    </li>
  );
}

/**
 * What this PUT/PATCH actually changed: the resource the server returned, compared with the
 * previous copy of the same resource in the logs (same direction and SP).
 */
export function ChangesView({ log }: { log: RequestLog }) {
  const isUser = !!log.user_id;
  const resourceId = (log.user_id ?? log.group_id)!;
  // Same query keys as useUserLogs/useGroupLogs, so the cache is shared
  const { data: history, isLoading } = useQuery({
    queryKey: [isUser ? 'users' : 'groups', resourceId, 'logs'],
    queryFn: async () => (await (isUser ? adminApi.getUserLogs(resourceId) : adminApi.getGroupLogs(resourceId))).data,
  });

  const after = resourceOf(log.response_body);
  if (!after) {
    return <p className="hint">The server didn’t return the updated resource (for example a 204 No Content), so there’s nothing to compare.</p>;
  }
  if (isLoading) return <p className="hint">Looking for the previous version…</p>;

  const sameChannel = (l: RequestLog) =>
    (l.direction ?? 'inbound') === (log.direction ?? 'inbound') && (l.target_id ?? null) === (log.target_id ?? null);
  const before = (history ?? [])
    .filter((l) => l.id < log.id && ok(l) && sameChannel(l))
    .map((l) => resourceOf(l.response_body, after.id as string))
    .find(Boolean);

  if (!before) {
    return <p className="hint">No earlier copy of this resource in the logs to compare with. Changes show up from the second update onwards.</p>;
  }

  const changes = diffResources(before, after);
  const counts = (['added', 'changed', 'removed'] as const)
    .map((k) => [k, changes.filter((c) => c.kind === k).length] as const)
    .filter(([, n]) => n);

  return (
    <div>
      <p className="hint mb-3">
        {changes.length === 0
          ? 'Nothing changed. The resource is identical to the previous version.'
          : counts.map(([k, n]) => `${n} ${MARK[k].label.toLowerCase()}`).join(', ') + ', compared with the previous version in the logs.'}
      </p>
      {changes.length > 0 && (
        <ul className="panel px-4 py-2 divide-y divide-line">
          {changes.map((c) => <ChangeRow key={c.kind + c.path} c={c} />)}
        </ul>
      )}
    </div>
  );
}
