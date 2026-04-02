import { useState } from 'react';
import { useTargets, usePlaybackEntity, usePlaybackLog } from '../../hooks/usePlayback';
import { JsonBlock } from '../common/JsonBlock';

function statusStyle(code: number) {
  if (code < 300) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  if (code < 400) return 'bg-yellow-50 text-yellow-700 ring-yellow-600/20';
  return 'bg-red-50 text-red-700 ring-red-600/20';
}

interface PlaybackResult {
  status: number;
  data: any;
}

// ─── Entity Push ─────────────────────────────────────────────────────────────

interface EntityPlaybackPickerProps {
  entityType: 'User' | 'Group';
  scimitId: string;
}

export function EntityPlaybackPicker({ entityType, scimitId }: EntityPlaybackPickerProps) {
  const { data: targets, isLoading: loadingTargets } = useTargets();
  const mutation = usePlaybackEntity();
  const [selectedTargetId, setSelectedTargetId] = useState<number | ''>('');
  const [result, setResult] = useState<PlaybackResult | null>(null);

  const handlePush = () => {
    if (!selectedTargetId) return;
    setResult(null);
    mutation.mutate(
      { entityType, scimitId, targetId: selectedTargetId as number },
      {
        onSuccess: (res) => setResult(res.data as PlaybackResult),
        onError: (err: any) => setResult({ status: 500, data: err }),
      }
    );
  };

  if (loadingTargets) {
    return <p className="text-xs text-slate-400">Loading targets…</p>;
  }

  if (!targets || targets.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        No playback targets configured.{' '}
        <a href="/playback" className="text-indigo-500 hover:underline">Add one on the Playback page.</a>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={selectedTargetId}
          onChange={(e) => setSelectedTargetId(e.target.value ? Number(e.target.value) : '')}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-700"
        >
          <option value="">Select target…</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          onClick={handlePush}
          disabled={!selectedTargetId || mutation.isPending}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? 'Pushing…' : `Push ${entityType}`}
        </button>
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${statusStyle(result.status)}`}>
              {result.status}
            </span>
            <span className="text-xs text-slate-400">
              {result.status === 201 ? 'Created — ID mapping saved' : result.status === 200 ? 'Updated' : 'Failed'}
            </span>
          </div>
          {result.data && <JsonBlock data={result.data} />}
        </div>
      )}
    </div>
  );
}

// ─── Log Replay ───────────────────────────────────────────────────────────────

interface LogPlaybackPickerProps {
  logId: number;
}

export function LogPlaybackPicker({ logId }: LogPlaybackPickerProps) {
  const { data: targets, isLoading: loadingTargets } = useTargets();
  const mutation = usePlaybackLog();
  const [selectedTargetId, setSelectedTargetId] = useState<number | ''>('');
  const [result, setResult] = useState<PlaybackResult | null>(null);

  const handleReplay = () => {
    if (!selectedTargetId) return;
    setResult(null);
    mutation.mutate(
      { logId, targetId: selectedTargetId as number },
      {
        onSuccess: (res) => setResult(res.data as PlaybackResult),
        onError: (err: any) => setResult({ status: 500, data: err }),
      }
    );
  };

  if (loadingTargets) {
    return <p className="text-xs text-slate-400">Loading targets…</p>;
  }

  if (!targets || targets.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        No playback targets configured.{' '}
        <a href="/playback" className="text-indigo-500 hover:underline">Add one on the Playback page.</a>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={selectedTargetId}
          onChange={(e) => setSelectedTargetId(e.target.value ? Number(e.target.value) : '')}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-700"
        >
          <option value="">Select target…</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          onClick={handleReplay}
          disabled={!selectedTargetId || mutation.isPending}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? 'Replaying…' : 'Replay'}
        </button>
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${statusStyle(result.status)}`}>
              {result.status}
            </span>
            <span className="text-xs text-slate-400">
              {result.status === 201 ? 'Created — ID mapping saved' : result.status === 200 ? 'Updated' : 'Response received'}
            </span>
          </div>
          {result.data && <JsonBlock data={result.data} />}
        </div>
      )}
    </div>
  );
}
