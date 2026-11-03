import { Fragment, useState } from 'react';
import { revealRow, useUrlIntent } from '../../hooks/useUrlIntent';
import { Activity } from 'lucide-react';
import { RequestLog } from '../../types/scim';
import { JsonBlock } from '../common/JsonBlock';
import { LogPlaybackPicker } from '../playback/PlaybackPicker';
import { useTargets } from '../../hooks/usePlayback';
import { ChangesView, hasChanges } from './ChangesView';
import { DirectionTag, EmptyState, MethodTag, PathText, StatusTag, SubHeading, Tabs, formatTime, railClass } from '../common/ui';

// Shown decoded, as a person would read it (not re-encoded with + for spaces)
export const queryString = (q?: Record<string, any>) => {
  const s = Object.entries(q ?? {}).map(([k, v]) => `${k}=${v}`).join('&');
  return s ? `?${s}` : '';
};

type Tab = 'changes' | 'request' | 'response' | 'replay';

export function LogDetail({ log, replay = true, inset = false }: { log: RequestLog; replay?: boolean; inset?: boolean }) {
  const changes = hasChanges(log);
  const [tab, setTab] = useState<Tab>(changes ? 'changes' : 'request');
  const tabs: { id: Tab; label: string }[] = [
    ...(changes ? [{ id: 'changes' as Tab, label: 'Changes' }] : []),
    { id: 'request', label: 'Request' },
    { id: 'response', label: 'Response' },
  ];
  if (replay && log.direction !== 'outbound') tabs.push({ id: 'replay', label: 'Replay to SP' });

  return (
    <div>
      <Tabs<Tab> tabs={tabs} value={tab} onChange={setTab} inset={inset} />
      <div className={inset ? 'page-pad' : ''}>
      {tab === 'changes' && <ChangesView log={log} />}

      {tab === 'request' && (
        <div className="space-y-4">
          {log.request_body && (
            <div>
              <SubHeading>Body</SubHeading>
              <JsonBlock data={log.request_body} />
            </div>
          )}
          <div>
            <SubHeading>Headers</SubHeading>
            <JsonBlock data={log.headers} />
          </div>
          {(log.ip_address || log.user_agent) && (
            <dl className="flex flex-wrap gap-x-8 gap-y-1 text-xs">
              {log.ip_address && <div><dt className="inline text-mute">IP </dt><dd className="inline font-mono text-graphite">{log.ip_address}</dd></div>}
              {log.user_agent && <div><dt className="inline text-mute">User agent </dt><dd className="inline font-mono text-graphite">{log.user_agent}</dd></div>}
            </dl>
          )}
        </div>
      )}

      {tab === 'response' && (
        <div className="space-y-4">
          {log.response_body ? (
            <div>
              <SubHeading>Body</SubHeading>
              <JsonBlock data={log.response_body} />
            </div>
          ) : (
            <p className="hint">No response body.</p>
          )}
          <div>
            <SubHeading>Headers</SubHeading>
            <JsonBlock data={log.response_headers} />
          </div>
        </div>
      )}

      {tab === 'replay' && (
        <div>
          <p className="hint mb-3 max-w-[68ch]">
            Sends this request to an SP. IDs in the path and members are swapped for the SP's IDs where SCIMit knows them.
          </p>
          <LogPlaybackPicker logId={log.id} />
        </div>
      )}
      </div>
    </div>
  );
}

export function LogList({ logs }: { logs: RequestLog[] }) {
  const { data: targets } = useTargets();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  useUrlIntent('open', (id) => { setExpandedId(Number(id)); revealRow(id); });
  const [direction, setDirection] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');

  if (logs.length === 0) {
    return (
      <div className="page-pad"><EmptyState icon={Activity} title="No requests yet">
        Requests appear here live as your IdP calls SCIMit, and as SCIMit sends to your SPs.
      </EmptyState></div>
    );
  }

  const targetName = (id?: number | null) => targets?.find((t) => t.id === id)?.name;
  const filtered = logs.filter(
    (l) =>
      (!direction || (l.direction ?? 'inbound') === direction) &&
      (!method || l.method === method) &&
      (!status || String(l.status_code) === status)
  );
  const methods = [...new Set(logs.map((l) => l.method))].sort();
  const statuses = [...new Set(logs.map((l) => l.status_code))].sort();

  return (
    <div>
      <div className="page-pad flex flex-wrap gap-2 mb-4">
        <select aria-label="Direction" value={direction} onChange={(e) => setDirection(e.target.value)} className="select">
          <option value="">Received and sent</option>
          <option value="inbound">Received from IdP</option>
          <option value="outbound">Sent to SP</option>
        </select>
        <select aria-label="Method" value={method} onChange={(e) => setMethod(e.target.value)} className="select">
          <option value="">Any method</option>
          {methods.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="select">
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s} value={s}>{s || 'No response'}</option>)}
        </select>
      </div>

      <div className="table-wrap"><table className="data-table bleed">
        <thead>
          <tr>
            <th className="max-md:hidden">Time</th>
            <th>Direction</th>
            <th>Request</th>
            <th>Status</th>
            <th className="text-right max-md:hidden">Duration</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((log) => {
            const open = expandedId === log.id;
            const qs = queryString(log.query_params);
            return (
              <Fragment key={log.id}>
                <tr className={`row ${railClass(log.direction)} ${log._live ? (log.direction === 'outbound' ? 'row-new-out' : 'row-new-in') : ''}`} id={`row-${log.id}`} aria-expanded={open} onClick={() => setExpandedId(open ? null : log.id)}>
                  <td className="max-md:hidden text-[13px] text-graphite whitespace-nowrap">{formatTime(log.timestamp)}</td>
                  <td className="whitespace-nowrap"><DirectionTag direction={log.direction} target={targetName(log.target_id)} /></td>
                  <td className="md:max-w-0 md:w-full">
                    <div className="flex items-baseline gap-2.5 min-w-0">
                      <span className="w-12 shrink-0"><MethodTag method={log.method} /></span>
                      <PathText path={log.path} query={qs} className="text-[13px]" />
                    </div>
                  </td>
                  <td><StatusTag code={log.status_code} /></td>
                  <td className="max-md:hidden text-right font-mono text-xs text-graphite whitespace-nowrap">{log.duration_ms} ms</td>
                </tr>
                {open && (
                  <tr className="detail">
                    <td colSpan={5} className={railClass(log.direction)} onClick={(e) => e.stopPropagation()}>
                      <LogDetail log={log} inset />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table></div>
      {filtered.length === 0 && <p className="page-pad py-10 text-center hint">No requests match these filters.</p>}
    </div>
  );
}
