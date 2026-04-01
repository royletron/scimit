import { useState } from 'react';
import { RequestLog } from '../../types/scim';
import { JsonBlock } from '../common/JsonBlock';

const METHOD_STYLES: Record<string, string> = {
  GET:    'bg-blue-50 text-blue-700 ring-blue-600/20',
  POST:   'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  PUT:    'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  PATCH:  'bg-orange-50 text-orange-700 ring-orange-600/20',
  DELETE: 'bg-red-50 text-red-700 ring-red-600/20',
};

function statusStyle(code: number) {
  if (code < 300) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  if (code < 400) return 'bg-yellow-50 text-yellow-700 ring-yellow-600/20';
  return 'bg-red-50 text-red-700 ring-red-600/20';
}

function LogDetail({ log }: { log: RequestLog }) {
  const [tab, setTab] = useState<'request' | 'response'>('request');

  const tabClass = (t: typeof tab) =>
    `px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-indigo-500 text-indigo-600'
        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
    }`;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 mt-2 shadow-sm">
      <div className="flex border-b border-slate-100 mb-3">
        <button className={tabClass('request')} onClick={() => setTab('request')}>Request</button>
        <button className={tabClass('response')} onClick={() => setTab('response')}>Response</button>
      </div>

      {tab === 'request' && (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Headers</p>
            <JsonBlock data={log.headers} />
          </div>
          {log.request_body && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Body</p>
              <JsonBlock data={log.request_body} />
            </div>
          )}
        </div>
      )}

      {tab === 'response' && (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Headers</p>
            <JsonBlock data={log.response_headers} />
          </div>
          {log.response_body && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Body</p>
              <JsonBlock data={log.response_body} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ActivityLogsProps {
  logs: RequestLog[];
  isLoading: boolean;
}

export function ActivityLogs({ logs, isLoading }: ActivityLogsProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) {
    return <div className="text-xs text-slate-400 animate-pulse">Loading activity…</div>;
  }

  if (logs.length === 0) {
    return <div className="text-xs text-slate-400 italic">No activity logs found for this resource.</div>;
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="border-l-2 border-slate-200 pl-4 py-1">
          <div
            className="flex items-center gap-3 cursor-pointer hover:bg-slate-100/50 rounded px-2 py-1 -ml-2 transition-colors"
            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
          >
            <span className="text-[10px] font-mono text-slate-400 w-32">
              {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ring-1 ring-inset ${METHOD_STYLES[log.method] ?? 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
              {log.method}
            </span>
            <span className="text-xs text-slate-600 font-mono truncate max-w-xs">{log.path}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ring-1 ring-inset ${statusStyle(log.status_code)}`}>
              {log.status_code}
            </span>
            <span className="text-[10px] text-slate-400 ml-auto">{log.duration_ms}ms</span>
          </div>
          {expandedId === log.id && <LogDetail log={log} />}
        </div>
      ))}
    </div>
  );
}
