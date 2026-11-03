import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, TriangleAlert } from 'lucide-react';
import { useTargets, usePlaybackEntity, usePlaybackLog } from '../../hooks/usePlayback';
import { JsonBlock } from '../common/JsonBlock';
import { StatusTag } from '../common/ui';
import { toast, errorText } from '../common/toast';

interface Result {
  status: number;
  data: any;
  warnings?: string[];
}

function outcome(r: Result) {
  if (r.status === 201) return 'Created on the SP. SCIMit saved its ID for future updates.';
  if (r.status >= 200 && r.status < 300) return 'Updated on the SP.';
  if (!r.status) return 'The SP didn’t respond.';
  return 'The SP rejected the request.';
}

function Picker({ label, pendingLabel, run }: { label: string; pendingLabel: string; run: (targetId: number) => Promise<{ data: unknown }> }) {
  const { data: targets, isLoading } = useTargets();
  const [targetId, setTargetId] = useState<number | ''>('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  if (isLoading) return <p className="hint">Loading SPs…</p>;
  if (!targets?.length) {
    return (
      <p className="hint">
        No SPs set up yet. <Link to="/playback" className="text-ink underline underline-offset-2">Add one on Send to SP</Link>.
      </p>
    );
  }

  const send = async () => {
    if (!targetId) return;
    setPending(true);
    setResult(null);
    const sp = targets.find((t) => t.id === targetId)?.name ?? 'SP';
    try {
      const r = (await run(targetId)).data as Result;
      setResult(r);
      if (r.status >= 200 && r.status < 300) toast.success(`Sent to ${sp}`, outcome(r));
      else toast.error(`${sp} didn’t accept it`, r.status ? `HTTP ${r.status}. Details are below.` : outcome(r));
    } catch (err: any) {
      setResult({ status: 0, data: err });
      toast.error('Couldn’t send', errorText(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="SP" value={targetId} onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : '')} className="select min-w-56">
          <option value="">Choose an SP</option>
          {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={send} disabled={!targetId || pending} className="btn btn-primary">
          <Send size={15} aria-hidden /> {pending ? pendingLabel : label}
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <StatusTag code={result.status} />
            <span className="text-[13px] text-graphite">{outcome(result)}</span>
          </div>
          {result.warnings?.map((w, i) => (
            <p key={i} className="flex gap-2 text-[13px] text-warn"><TriangleAlert size={15} className="shrink-0 mt-0.5" aria-hidden />{w}</p>
          ))}
          {result.data && <JsonBlock data={result.data} />}
        </div>
      )}
    </div>
  );
}

export function EntityPlaybackPicker({ entityType, scimitId }: { entityType: 'User' | 'Group'; scimitId: string }) {
  const mutation = usePlaybackEntity();
  return (
    <Picker
      label={`Send ${entityType.toLowerCase()}`}
      pendingLabel="Sending…"
      run={(targetId) => mutation.mutateAsync({ entityType, scimitId, targetId })}
    />
  );
}

export function LogPlaybackPicker({ logId }: { logId: number }) {
  const mutation = usePlaybackLog();
  return <Picker label="Replay request" pendingLabel="Replaying…" run={(targetId) => mutation.mutateAsync({ logId, targetId })} />;
}
