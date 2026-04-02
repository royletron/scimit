import { useState } from 'react';
import { PlaybackTarget, PlaybackIdMapping } from '../types/scim';
import {
  useTargets,
  useMappings,
  useCreateTarget,
  useUpdateTarget,
  useDeleteTarget,
  useDeleteMapping,
} from '../hooks/usePlayback';

// ─── Target Form ────────────────────────────────────────────────────────────

interface TargetFormProps {
  initial?: PlaybackTarget;
  onSubmit: (data: { name: string; url: string; token?: string }) => void;
  onCancel: () => void;
  loading: boolean;
}

function TargetForm({ initial, onSubmit, onCancel, loading }: TargetFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [token, setToken] = useState(initial?.token ?? '');

  const inputClass =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, url, token: token || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Okta Production"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Base URL</label>
        <input
          className={inputClass}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-scim-target.example.com/scim/v2"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Bearer Token (optional)</label>
        <input
          className={inputClass}
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Leave blank if not required"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving…' : initial ? 'Update Target' : 'Add Target'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Mapping List ────────────────────────────────────────────────────────────

function MappingRow({ mapping, onDelete }: { mapping: PlaybackIdMapping; onDelete: () => void }) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-2.5 text-xs text-slate-500">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
          mapping.entity_type === 'User'
            ? 'bg-blue-50 text-blue-700 ring-blue-600/20'
            : 'bg-violet-50 text-violet-700 ring-violet-600/20'
        }`}>
          {mapping.entity_type}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{mapping.scimit_id}</td>
      <td className="px-4 py-2.5 text-xs text-slate-400">→</td>
      <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{mapping.target_id_value}</td>
      <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
        {new Date(mapping.created_at).toLocaleString()}
      </td>
      <td className="px-4 py-2.5 text-right">
        <button
          onClick={onDelete}
          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

function TargetMappings({ targetId }: { targetId: number }) {
  const { data: mappings, isLoading } = useMappings(targetId);
  const deleteMapping = useDeleteMapping();

  if (isLoading) {
    return <p className="text-xs text-slate-400 py-2">Loading mappings…</p>;
  }

  if (!mappings || mappings.length === 0) {
    return (
      <p className="text-xs text-slate-400 py-2">
        No ID mappings yet. Mappings are created automatically when entities are replayed to this target.
      </p>
    );
  }

  return (
    <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">SCIMit ID</th>
            <th className="px-4 py-2" />
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Target ID</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {mappings.map((m) => (
            <MappingRow
              key={m.id}
              mapping={m}
              onDelete={() => deleteMapping.mutate(m.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Target Card ─────────────────────────────────────────────────────────────

interface TargetCardProps {
  target: PlaybackTarget;
}

function TargetCard({ target }: TargetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const updateTarget = useUpdateTarget();
  const deleteTarget = useDeleteTarget();

  const handleUpdate = (data: { name: string; url: string; token?: string }) => {
    updateTarget.mutate(
      { id: target.id, data },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleDelete = () => {
    if (!confirm(`Delete target "${target.name}"? This will also remove all its ID mappings.`)) return;
    deleteTarget.mutate(target.id);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{target.name}</p>
          <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{target.url}</p>
          {target.token && (
            <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              Bearer token configured
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setEditing((e) => !e); setExpanded(false); }}
            className="text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => { setExpanded((e) => !e); setEditing(false); }}
            className="text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
          >
            {expanded ? 'Hide Mappings' : 'View Mappings'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteTarget.isPending}
            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
          <TargetForm
            initial={target}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            loading={updateTarget.isPending}
          />
        </div>
      )}

      {expanded && (
        <div className="px-5 py-4 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">ID Mappings</p>
          <p className="text-xs text-slate-400 mb-2">
            Tracks how SCIMit IDs correspond to IDs assigned by this target system. Used for ID substitution during replay.
          </p>
          <TargetMappings targetId={target.id} />
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function PlaybackPage() {
  const { data: targets, isLoading, error } = useTargets();
  const createTarget = useCreateTarget();
  const [showForm, setShowForm] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
        <svg className="animate-spin h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading targets…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-red-500 text-sm gap-2">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Error loading playback targets
      </div>
    );
  }

  const count = targets?.length ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Playback</h2>
            <span className="text-sm text-slate-400">{count} {count === 1 ? 'target' : 'targets'}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Configure SCIM targets to replay captured requests or push entities. ID mappings are tracked automatically.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="shrink-0 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Target'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-5">
          <p className="text-sm font-semibold text-slate-900 mb-4">New Playback Target</p>
          <TargetForm
            onSubmit={(data) => createTarget.mutate(data, { onSuccess: () => setShowForm(false) })}
            onCancel={() => setShowForm(false)}
            loading={createTarget.isPending}
          />
        </div>
      )}

      {targets && targets.length > 0 ? (
        <div className="space-y-3">
          {targets.map((target) => (
            <TargetCard key={target.id} target={target} />
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm text-center py-16">
            <p className="text-slate-400 text-sm mb-1">No playback targets configured</p>
            <p className="text-slate-400 text-xs">Add a target to start replaying SCIM requests to another system.</p>
          </div>
        )
      )}
    </div>
  );
}
