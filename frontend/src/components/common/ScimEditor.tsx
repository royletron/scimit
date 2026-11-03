import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Braces, Check, Rows3, Trash2 } from 'lucide-react';
import { useUsers } from '../../hooks/useUsers';
import { toast } from './toast';

export const USER_TEMPLATE = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
  userName: '',
  active: true,
};

export const GROUP_TEMPLATE = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
  displayName: '',
};

// ─── Simple-mode field accessors (read/write into the SCIM document) ─────────

type Doc = Record<string, any>;

// Empty values remove the attribute instead of sending "" (absent ≠ empty in SCIM)
function setOrDelete(obj: Doc, key: string, value: any) {
  const next = { ...obj };
  if (value === '' || value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

const primaryEmail = (d: Doc): string =>
  d.emails?.find((e: any) => e.primary)?.value ?? d.emails?.[0]?.value ?? '';

function setPrimaryEmail(d: Doc, value: string): Doc {
  const others = (d.emails ?? []).filter((e: any) => e.value !== primaryEmail(d));
  const emails = value ? [{ value, type: 'work', primary: true }, ...others] : others;
  return setOrDelete(d, 'emails', emails.length ? emails : undefined);
}

function setName(d: Doc, key: 'givenName' | 'familyName', value: string): Doc {
  const name = setOrDelete(d.name ?? {}, key, value);
  return setOrDelete(d, 'name', Object.keys(name).length ? name : undefined);
}

interface Field {
  label: string;
  get: (d: Doc) => string;
  set: (d: Doc, v: string) => Doc;
  placeholder?: string;
  required?: boolean;
  mono?: boolean;
}

const attr = (key: string, label: string, placeholder?: string, required?: boolean, mono?: boolean): Field => ({
  label, placeholder, required, mono,
  get: (d) => d[key] ?? '',
  set: (d, v) => setOrDelete(d, key, v),
});

const USER_FIELDS: Field[] = [
  attr('userName', 'Username', 'jane.doe@example.com', true, true),
  { label: 'Primary email', placeholder: 'jane.doe@example.com', get: primaryEmail, set: setPrimaryEmail, mono: true },
  attr('displayName', 'Display name', 'Jane Doe'),
  { label: 'Given name', placeholder: 'Jane', get: (d) => d.name?.givenName ?? '', set: (d, v) => setName(d, 'givenName', v) },
  { label: 'Family name', placeholder: 'Doe', get: (d) => d.name?.familyName ?? '', set: (d, v) => setName(d, 'familyName', v) },
  attr('externalId', 'External ID', 'jane-001', false, true),
];

const GROUP_FIELDS: Field[] = [
  attr('displayName', 'Display name', 'Engineering', true),
  attr('externalId', 'External ID', 'eng-001', false, true),
];

// ─── Editor ──────────────────────────────────────────────────────────────────

interface ScimEditorProps {
  kind: 'User' | 'Group';
  initial: any;
  onSave: (body: any) => Promise<unknown>;
  onDone?: () => void;
  onDelete?: () => Promise<unknown>;
  saveLabel?: string;
}

export function ScimEditor({ kind, initial, onSave, onDone, onDelete, saveLabel = 'Save changes' }: ScimEditorProps) {
  const queryClient = useQueryClient();
  const { data: users } = useUsers();
  const { id: _id, meta: _meta, members, ...editable } = initial ?? {};
  const [doc, setDoc] = useState<Doc>(editable);
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string[]>((members ?? []).map((m: any) => m.value ?? m.memberId));
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  };
  const fail = (e: any) => setError(e?.detail || e?.message || 'Request failed');
  const nameOf = (d: Doc) => (kind === 'User' ? d.userName : d.displayName);
  // Create forms have no delete; edit forms do
  const save = useMutation({
    mutationFn: onSave,
    onSuccess: (_r, body) => {
      invalidate();
      toast.success(onDelete ? 'Changes saved' : `${kind} created`, nameOf(body));
      onDone?.();
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => onDelete!(),
    onSuccess: () => {
      invalidate();
      toast.success(`${kind} deleted`, 'Sync all will also delete it on any SP it was sent to.');
    },
    onError: fail,
  });

  // Returns the current document, parsing the JSON if in advanced mode (null on invalid JSON)
  const current = (): Doc | null => {
    if (mode === 'simple') return doc;
    try {
      return JSON.parse(text);
    } catch (e: any) {
      setError(`Invalid JSON: ${e.message}`);
      return null;
    }
  };

  const switchMode = (next: 'simple' | 'advanced') => {
    if (next === mode) return;
    const d = current();
    if (!d) return;
    setError(null);
    setDoc(d);
    setText(JSON.stringify(d, null, 2));
    setMode(next);
  };

  const handleSave = () => {
    const d = current();
    if (!d) return;
    const body = { ...d };
    if (kind === 'Group') {
      body.members = selected.map((id) => ({
        value: id,
        type: 'User',
        display: users?.find((u) => u.id === id)?.userName,
      }));
    }
    setError(null);
    save.mutate(body);
  };

  const handleDelete = () => {
    if (!confirm(`Delete this ${kind.toLowerCase()}? The next sync will DELETE it on targets it was pushed to.`)) return;
    remove.mutate();
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const segClass = (m: typeof mode) =>
    `inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded transition-colors ${
      mode === m ? 'bg-paper text-ink shadow-[0_0_0_1px_var(--color-line-strong)]' : 'text-graphite hover:text-ink'
    }`;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="inline-flex gap-0.5 bg-chalk rounded-md p-0.5" role="group" aria-label="Editor mode">
        <button type="button" aria-pressed={mode === 'simple'} className={segClass('simple')} onClick={() => switchMode('simple')}>
          <Rows3 size={13} aria-hidden /> Fields
        </button>
        <button type="button" aria-pressed={mode === 'advanced'} className={segClass('advanced')} onClick={() => switchMode('advanced')}>
          <Braces size={13} aria-hidden /> JSON
        </button>
      </div>

      {mode === 'simple' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(kind === 'User' ? USER_FIELDS : GROUP_FIELDS).map((f) => (
            <div key={f.label}>
              <label className="field-label" htmlFor={`f-${f.label}`}>
                {f.label}{f.required && <span className="text-err"> *</span>}
              </label>
              <input
                id={`f-${f.label}`}
                className={`input ${f.mono ? 'font-mono text-[13px]' : ''}`}
                required={f.required}
                value={f.get(doc)}
                placeholder={f.placeholder}
                onChange={(e) => setDoc((d) => f.set(d, e.target.value))}
              />
            </div>
          ))}
          {kind === 'User' && (
            <label className="flex items-center gap-2 text-sm text-ink self-end h-9">
              <input
                className="h-4 w-4 accent-ink"
                type="checkbox"
                checked={doc.active !== false}
                onChange={(e) => setDoc((d) => ({ ...d, active: e.target.checked }))}
              />
              Active
            </label>
          )}
        </div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={Math.min(24, text.split('\n').length + 1)}
          aria-label="SCIM resource JSON"
          className="w-full font-mono text-[12.5px] leading-[1.65] bg-code text-code-fg caret-code-key p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-disco"
        />
      )}

      {kind === 'Group' && (
        <div>
          <p className="field-label">Members <span className="text-mute font-normal">({selected.length} selected)</span></p>
          {users && users.length > 0 ? (
            <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-[13px] text-ink min-w-0 cursor-pointer">
                  <input className="h-4 w-4 accent-ink shrink-0" type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
                  <span className="font-mono text-xs truncate">{u.userName}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="hint">No users yet. Create some first, then add them here.</p>
          )}
        </div>
      )}

      {mode === 'simple' && (
        <p className="hint">
          {kind === 'User'
            ? 'Need phone numbers, the enterprise extension or custom attributes? Switch to JSON.'
            : 'Need custom attributes? Switch to JSON.'}{' '}
          Anything you add there is kept when you switch back.
        </p>
      )}

      {error && <p className="text-[13px] text-err" role="alert">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={save.isPending} className="btn btn-primary">
          <Check size={15} aria-hidden /> {save.isPending ? 'Saving…' : saveLabel}
        </button>
        {onDone && <button onClick={onDone} className="btn btn-ghost">Cancel</button>}
        {onDelete && (
          <button onClick={handleDelete} disabled={remove.isPending} className="btn btn-danger ml-auto">
            <Trash2 size={15} aria-hidden /> {remove.isPending ? 'Deleting…' : `Delete ${kind.toLowerCase()}`}
          </button>
        )}
      </div>
    </div>
  );
}
