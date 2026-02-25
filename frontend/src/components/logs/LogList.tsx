import { useState } from 'react';
import { RequestLog } from '../../types/scim';
import { JsonBlock } from '../common/JsonBlock';

interface LogListProps {
  logs: RequestLog[];
}

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
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-indigo-500 text-indigo-600'
        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
    }`;

  return (
    <div>
      <div className="flex border-b border-slate-200 mb-4">
        <button className={tabClass('request')} onClick={() => setTab('request')}>Request</button>
        <button className={tabClass('response')} onClick={() => setTab('response')}>Response</button>
      </div>

      {tab === 'request' && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Headers</p>
            <JsonBlock data={log.headers} />
          </div>
          {log.request_body && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Body</p>
              <JsonBlock data={log.request_body} />
            </div>
          )}
        </div>
      )}

      {tab === 'response' && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Headers</p>
            <JsonBlock data={log.response_headers} />
          </div>
          {log.response_body && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Body</p>
              <JsonBlock data={log.response_body} />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-6 text-xs text-slate-500 mt-4 pt-3 border-t border-slate-200">
        <span><span className="font-medium text-slate-600">IP:</span> {log.ip_address || 'N/A'}</span>
        <span><span className="font-medium text-slate-600">User Agent:</span> {log.user_agent || 'N/A'}</span>
      </div>
    </div>
  );
}

export function LogList({ logs }: LogListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const filteredLogs = logs.filter((log) => {
    if (methodFilter && log.method !== methodFilter) return false;
    if (statusFilter && log.status_code.toString() !== statusFilter) return false;
    return true;
  });

  const uniqueMethods = Array.from(new Set(logs.map((l) => l.method)));
  const uniqueStatuses = Array.from(new Set(logs.map((l) => l.status_code)));

  const selectClass = "text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-700";

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className={selectClass}>
          <option value="">All Methods</option>
          {uniqueMethods.map((method) => (
            <option key={method} value={method}>{method}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="">All Status Codes</option>
          {uniqueStatuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="min-w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Path</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.map((log) => (
              <>
                <tr
                  key={log.id}
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-3.5 text-sm whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${METHOD_STYLES[log.method] ?? 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
                      {log.method}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-slate-900 font-mono">
                    {log.path}
                  </td>
                  <td className="px-6 py-3.5 text-sm whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${statusStyle(log.status_code)}`}>
                      {log.status_code}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                    {log.duration_ms}ms
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 bg-slate-50 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                      <LogDetail log={log} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            {logs.length === 0 ? 'No request logs yet' : 'No logs match your filters'}
          </div>
        )}
      </div>
    </div>
  );
}
