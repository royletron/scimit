import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Link2, Unlink, Pencil, Plus, RefreshCw, Send, Trash2, TriangleAlert } from 'lucide-react';
import { PlaybackTarget, SyncResult } from '../types/scim';
import { playbackApi } from '../services/api';
import { useUrlIntent } from '../hooks/useUrlIntent';
import { useTargets, useMappings, useCreateTarget, useUpdateTarget, useDeleteTarget, useDeleteMapping } from '../hooks/usePlayback';
import { toast, errorText } from '../components/common/toast';
import { Badge, EmptyState, ErrorState, Loading, PageHeader, StatusTag, formatTime, railClass } from '../components/common/ui';

// ─── Target form ─────────────────────────────────────────────────────────────

type TargetData = { name: string; url: string; token?: string };

function TargetForm({ initial, onSubmit, onCancel, loading }: {
  initial?: PlaybackTarget;
  onSubmit: (data: TargetData) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [token, setToken] = useState(initial?.token ?? '');

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit({ name, url, token: token || undefined }); }}
      className="grid gap-4 sm:grid-cols-2 max-w-3xl"
    >
      <div>
        <label className="field-label" htmlFor="t-name">Name</label>
        <input id="t-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Staging app" required />
      </div>
      <div>
        <label className="field-label" htmlFor="t-token">Bearer token <span className="text-mute font-normal">(optional)</span></label>
        <input id="t-token" className="input font-mono" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Leave blank if the SP doesn’t need one" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor="t-url">SCIM base URL</label>
        <input id="t-url" className="input font-mono" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://app.example.com/scim/v2" required />
      </div>
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Saving…' : initial ? 'Save changes' : 'Add SP'}</button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

// ─── Sync results ────────────────────────────────────────────────────────────

const isFailure = (r: SyncResult) =>
  (r.status >= 300 || !r.status) && r.action !== 'unchanged' && !(r.action === 'delete' && r.status === 404);

function announceSync(name: string, results: SyncResult[]) {
  const failed = results.filter(isFailure).length;
  const warned = results.filter((r) => r.warnings.length).length;
  if (results.every((r) => r.action === 'unchanged')) return toast.success(`${name} is up to date`, 'Nothing had changed, so no requests were sent.');
  if (failed) return toast.error(`Sync finished with ${failed} ${failed === 1 ? 'failure' : 'failures'}`, `${name}. Details are below the SP.`);
  toast.success(`Synced ${name}`, `${results.length} ${results.length === 1 ? 'resource' : 'resources'}${warned ? `, ${warned} with spec warnings` : ''}.`);
}

const ACTION_LABEL: Record<SyncResult['action'], string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  unchanged: 'No change',
};

function SyncResults({ results, error }: { results?: SyncResult[]; error: any }) {
  if (error) return <p className="text-[13px] text-err">Sync didn’t run: {error.detail || error.message}</p>;
  if (!results?.length) return <p className="hint">Nothing to send. Create some users or groups first.</p>;

  const failed = results.filter(isFailure).length;
  const warned = results.filter((r) => r.warnings.length).length;
  if (results.every((r) => r.action === 'unchanged')) {
    return <p className="text-[13px] text-graphite">The SP is already up to date. No requests were sent.</p>;
  }

  return (
    <div>
      <p className="text-[13px] text-graphite mb-3">
        <span className="text-ink font-medium">{results.length} {results.length === 1 ? 'resource' : 'resources'}</span>
        {failed ? <span className="text-err">, {failed} failed</span> : ', all succeeded'}
        {warned > 0 && <span className="text-warn">, {warned} with spec warnings</span>}
        . Full requests are in Requests.
      </p>
      <ul className="panel divide-y divide-line">
        {results.map((r) => (
          <li key={r.entityType + r.id} className="px-4 py-2.5">
            <div className="grid grid-cols-[6.5rem_6rem_3.5rem_1fr] items-center gap-3 text-[13px]">
              {r.action === 'unchanged' ? <span className="font-mono text-xs text-mute">no request</span> : <StatusTag code={r.status} />}
              <span className="text-graphite">{ACTION_LABEL[r.action]}</span>
              <span className="text-mute">{r.entityType}</span>
              <span className="text-ink truncate">{r.name}</span>
            </div>
            {r.warnings.length > 0 && (
              <ul className="mt-1.5 ml-[18.25rem] space-y-1 max-sm:ml-0">
                {r.warnings.map((w, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-warn">
                    <TriangleAlert size={14} className="shrink-0 mt-px" aria-hidden />{w}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── ID mappings ─────────────────────────────────────────────────────────────

function TargetMappings({ targetId }: { targetId: number }) {
  const { data: mappings, isLoading } = useMappings(targetId);
  const deleteMapping = useDeleteMapping();

  if (isLoading) return <p className="hint">Loading ID mappings…</p>;
  if (!mappings?.length) return <p className="hint">No ID mappings yet. SCIMit records one each time the SP creates or matches a resource.</p>;

  return (
    <div className="table-wrap"><table className="data-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>SCIMit ID</th>
          <th>SP ID</th>
          <th>Version</th>
          <th>Linked</th>
          <th><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {mappings.map((m) => (
          <tr key={m.id}>
            <td className="text-[13px] text-graphite">{m.entity_type}</td>
            <td className="font-mono text-xs text-graphite">{m.scimit_id}</td>
            <td className="font-mono text-xs text-ink">{m.target_id_value}</td>
            <td className="font-mono text-xs text-mute">{m.version ?? 'none'}</td>
            <td className="text-xs text-graphite whitespace-nowrap">{formatTime(m.created_at)}</td>
            <td className="text-right">
              <button onClick={() => deleteMapping.mutate(m.id, { onSuccess: () => toast.success('Mapping forgotten', 'The next sync will look this resource up on the SP again.'), onError: (e) => toast.error('Couldn’t forget mapping', errorText(e)) })} className="btn btn-danger btn-sm" aria-label={`Forget mapping for ${m.scimit_id}`}>
                <Unlink size={13} aria-hidden /> Forget
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

// ─── Target ──────────────────────────────────────────────────────────────────

function TargetCard({ target }: { target: PlaybackTarget }) {
  const [view, setView] = useState<'none' | 'edit' | 'mappings'>('none');
  const [method, setMethod] = useState<'PATCH' | 'PUT'>('PATCH');
  const updateTarget = useUpdateTarget();
  const deleteTarget = useDeleteTarget();
  const queryClient = useQueryClient();
  const sync = useMutation({
    mutationFn: () => playbackApi.sync(target.id, method).then((r) => r.data),
    onSuccess: (results) => announceSync(target.name, results),
    onError: (e) => toast.error('Sync didn’t run', errorText(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['playback-mappings'] }),
  });

  const toggle = (v: typeof view) => setView((cur) => (cur === v ? 'none' : v));
  const handleDelete = () => {
    if (!confirm(`Remove “${target.name}”? SCIMit forgets its ID mappings. Nothing is deleted on the SP.`)) return;
    deleteTarget.mutate(target.id, {
      onSuccess: () => toast.success('SP removed', target.name),
      onError: (e) => toast.error('Couldn’t remove SP', errorText(e)),
    });
  };

  return (
    <section className={`panel overflow-hidden ${railClass('outbound')}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
        <div className="min-w-0">
          <h2 className="section-title">{target.name}</h2>
          <p className="font-mono text-xs text-graphite mt-1 truncate">{target.url}</p>
          <div className="mt-2.5">
            {target.token
              ? <Badge tone="ok"><KeyRound size={12} aria-hidden /> Bearer token set</Badge>
              : <Badge><KeyRound size={12} aria-hidden /> No token</Badge>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Send updates with"
            value={method}
            onChange={(e) => setMethod(e.target.value as 'PATCH' | 'PUT')}
            className="select"
            title="New resources are always created with POST, and removed ones with DELETE."
          >
            <option value="PATCH">Update with PATCH</option>
            <option value="PUT">Update with PUT</option>
          </select>
          <button onClick={() => sync.mutate()} disabled={sync.isPending} className="btn btn-primary">
            <RefreshCw size={15} className={sync.isPending ? 'animate-spin' : ''} aria-hidden />
            {sync.isPending ? 'Syncing…' : 'Sync all'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 px-4 pb-3 -mt-1">
        <button onClick={() => toggle('mappings')} aria-pressed={view === 'mappings'} className={`btn btn-ghost btn-sm ${view === 'mappings' ? 'bg-chalk text-ink' : ''}`}>
          <Link2 size={14} aria-hidden /> ID mappings
        </button>
        <button onClick={() => toggle('edit')} aria-pressed={view === 'edit'} className={`btn btn-ghost btn-sm ${view === 'edit' ? 'bg-chalk text-ink' : ''}`}>
          <Pencil size={14} aria-hidden /> Edit
        </button>
        <button onClick={handleDelete} disabled={deleteTarget.isPending} className="btn btn-danger btn-sm ml-auto">
          <Trash2 size={14} aria-hidden /> Remove
        </button>
      </div>

      {(sync.data || sync.error) && (
        <div className="px-6 py-5 border-t border-line bg-chalk/60">
          <SyncResults results={sync.data} error={sync.error} />
        </div>
      )}
      {view === 'edit' && (
        <div className="px-6 py-5 border-t border-line">
          <TargetForm
            initial={target}
            onSubmit={(data) => updateTarget.mutate({ id: target.id, data }, {
              onSuccess: () => { setView('none'); toast.success('SP updated', data.name); },
              onError: (e) => toast.error('Couldn’t save SP', errorText(e)),
            })}
            onCancel={() => setView('none')}
            loading={updateTarget.isPending}
          />
        </div>
      )}
      {view === 'mappings' && (
        <div className="px-6 py-5 border-t border-line">
          <p className="hint mb-3 max-w-[72ch]">
            How SCIMit’s IDs line up with the IDs this SP assigned. Updates, deletes and group members use the SP’s IDs. Forget a mapping to make the next sync look the resource up again.
          </p>
          <TargetMappings targetId={target.id} />
        </div>
      )}
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function PlaybackPage() {
  const { data: targets, isLoading, error } = useTargets();
  const createTarget = useCreateTarget();
  const [adding, setAdding] = useState(false);
  useUrlIntent('new', () => setAdding(true));

  if (isLoading) return <Loading label="Loading SPs…" />;
  if (error) return <ErrorState title="Couldn't load SPs" detail="Check that the SCIMit server is running." />;

  const count = targets?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Send to SP"
        meta={`${count} ${count === 1 ? 'SP' : 'SPs'}`}
        description="SCIMit acts as the IdP here. Sync all creates or updates every user and group on the SP, then deletes anything you’ve removed. Each response is checked against the SCIM spec."
        actions={!adding && <button onClick={() => setAdding(true)} className="btn btn-primary"><Plus size={16} aria-hidden /> Add SP</button>}
      />

      <div className="page-pad">
      {adding && (
        <section className="panel p-6 mb-6">
          <h2 className="section-title mb-4">Add an SP</h2>
          <TargetForm
            onSubmit={(data) => createTarget.mutate(data, {
              onSuccess: () => { setAdding(false); toast.success('SP added', data.name); },
              onError: (e) => toast.error('Couldn’t add SP', errorText(e)),
            })}
            onCancel={() => setAdding(false)}
            loading={createTarget.isPending}
          />
        </section>
      )}

      {count > 0 ? (
        <div className="space-y-5">
          {targets!.map((t) => <TargetCard key={t.id} target={t} />)}
        </div>
      ) : (
        !adding && (
          <EmptyState
            icon={Send}
            title="No SPs yet"
            action={<button onClick={() => setAdding(true)} className="btn btn-secondary"><Plus size={16} aria-hidden /> Add SP</button>}
          >
            Add the SCIM base URL of the app you’re testing. SCIMit will provision your users and groups into it, the way Okta or Entra would.
          </EmptyState>
        )
      )}
      </div>
    </div>
  );
}
