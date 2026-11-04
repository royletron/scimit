import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Download, ExternalLink, LogIn, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { SamlApp, SamlAppInput } from '../types/scim';
import { samlApi } from '../services/api';
import { useUrlIntent } from '../hooks/useUrlIntent';
import { CopyField } from '../components/common/CopyField';
import { EmptyState, ErrorState, Loading, PageHeader, SubHeading, railClass } from '../components/common/ui';
import { toast, errorText } from '../components/common/toast';

const FORMATS = [
  { value: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress', label: 'Email address' },
  { value: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified', label: 'Unspecified' },
  { value: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent', label: 'Persistent' },
];
const SOURCES = [
  { value: 'email', label: 'Primary email' },
  { value: 'userName', label: 'Username' },
  { value: 'id', label: 'SCIMit user ID' },
] as const;

const ATTRIBUTES = ['email', 'userName', 'firstName', 'lastName', 'displayName'];

// Names SPs commonly look for when mapping groups to roles
const GROUP_ATTRIBUTE_SUGGESTIONS = ['groups', 'memberOf', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'];

const useApps = () => useQuery({ queryKey: ['saml-apps'], queryFn: async () => (await samlApi.getApps()).data });

// ─── App form ────────────────────────────────────────────────────────────────

function AppForm({ initial, onDone }: { initial?: SamlApp; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [data, setData] = useState<SamlAppInput>({
    name: initial?.name ?? '',
    sp_entity_id: initial?.sp_entity_id ?? '',
    acs_url: initial?.acs_url ?? '',
    name_id_format: initial?.name_id_format ?? FORMATS[0].value,
    name_id_source: initial?.name_id_source ?? 'email',
    send_groups: Boolean(initial?.send_groups),
    groups_attribute: initial?.groups_attribute ?? 'groups',
  });
  const set = (k: keyof SamlAppInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => (initial ? samlApi.updateApp(initial.id, data) : samlApi.createApp(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saml-apps'] });
      toast.success(initial ? 'App updated' : 'App added', data.name);
      onDone();
    },
    onError: (e) => toast.error(initial ? 'Couldn’t save app' : 'Couldn’t add app', errorText(e)),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-4 sm:grid-cols-2 max-w-3xl">
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor="s-name">Name</label>
        <input id="s-name" className="input" value={data.name} onChange={set('name')} placeholder="My app (staging)" required />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor="s-acs">ACS URL <span className="text-mute font-normal">(where SCIMit posts the SAML response)</span></label>
        <input id="s-acs" className="input font-mono text-[13px]" type="url" value={data.acs_url} onChange={set('acs_url')} placeholder="https://app.example.com/saml/acs" required />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor="s-entity">SP entity ID <span className="text-mute font-normal">(sent as the Audience)</span></label>
        <input id="s-entity" className="input font-mono text-[13px]" value={data.sp_entity_id} onChange={set('sp_entity_id')} placeholder="https://app.example.com/saml/metadata" required />
      </div>
      <div>
        <label className="field-label" htmlFor="s-format">NameID format</label>
        <select id="s-format" className="select w-full" value={data.name_id_format} onChange={set('name_id_format')}>
          {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="s-source">NameID value</label>
        <select id="s-source" className="select w-full" value={data.name_id_source} onChange={set('name_id_source')}>
          {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2 rounded-md border border-line p-4">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 mt-0.5 accent-ink shrink-0"
            checked={data.send_groups}
            onChange={(e) => setData((d) => ({ ...d, send_groups: e.target.checked }))}
          />
          <span>
            <span className="block text-sm font-medium text-ink">Send group memberships</span>
            <span className="block hint mt-0.5">
              Adds the user’s groups to the assertion, one value per group, by display name. For SPs that create users on first sign-in (JIT) and map groups to roles.
            </span>
          </span>
        </label>
        {data.send_groups && (
          <div className="mt-3 ml-[1.625rem]">
            <label className="field-label" htmlFor="s-groups-attr">Attribute name</label>
            <input
              id="s-groups-attr" list="s-groups-attr-list" className="input font-mono text-[13px]"
              value={data.groups_attribute} onChange={set('groups_attribute')} placeholder="groups"
            />
            <datalist id="s-groups-attr-list">
              {GROUP_ATTRIBUTE_SUGGESTIONS.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
        )}
      </div>
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" disabled={save.isPending} className="btn btn-primary">
          <Check size={15} aria-hidden /> {save.isPending ? 'Saving…' : initial ? 'Save changes' : 'Add app'}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

// ─── App card ────────────────────────────────────────────────────────────────

function AppCard({ app }: { app: SamlApp }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const remove = useMutation({
    mutationFn: () => samlApi.deleteApp(app.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saml-apps'] });
      toast.success('App removed', app.name);
    },
    onError: (e) => toast.error('Couldn’t remove app', errorText(e)),
  });

  const format = FORMATS.find((f) => f.value === app.name_id_format)?.label ?? app.name_id_format;
  const source = SOURCES.find((s) => s.value === app.name_id_source)?.label ?? app.name_id_source;

  return (
    <section className={`panel overflow-hidden ${railClass('outbound')}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
        <div className="min-w-0">
          <h2 className="section-title">{app.name}</h2>
          <p className="font-mono text-xs text-graphite mt-1 truncate">{app.acs_url}</p>
        </div>
        {/* IdP-initiated, like an app tile in Okta: open the SSO URL and pick a user */}
        <a href={app.idp.ssoUrl} target="_blank" rel="noopener" className="btn btn-primary">
          <LogIn size={15} aria-hidden /> Sign in as a user <ExternalLink size={13} className="opacity-60" aria-hidden />
        </a>
      </div>

      {editing ? (
        <div className="px-6 pb-6">
          <AppForm initial={app} onDone={() => setEditing(false)} />
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] px-6 pb-5">
          <div className="space-y-4 min-w-0">
            <p className="hint">Most SPs can set themselves up from the metadata, by URL or as an uploaded file. Otherwise, copy the three values.</p>
            <CopyField label="Metadata URL" value={app.idp.metadataUrl}>
              <a href={`${app.idp.metadataUrl}?download=1`} className="btn btn-secondary" download>
                <Download size={15} aria-hidden /> metadata.xml
              </a>
            </CopyField>
            <CopyField label="SSO URL (HTTP-Redirect or HTTP-POST)" value={app.idp.ssoUrl} />
            <CopyField label="IdP entity ID (Issuer)" value={app.idp.entityId} />
          </div>
          <div>
            <SubHeading>What SCIMit sends</SubHeading>
            <dl className="text-[13px] space-y-2">
              <div><dt className="text-mute">Audience</dt><dd className="font-mono text-xs text-ink break-all">{app.sp_entity_id}</dd></div>
              <div><dt className="text-mute">NameID</dt><dd className="text-ink">{source}, as {format.toLowerCase()}</dd></div>
              <div>
                <dt className="text-mute">Attributes</dt>
                <dd className="font-mono text-xs text-ink leading-relaxed">{ATTRIBUTES.join(', ')}</dd>
              </div>
              <div>
                <dt className="text-mute">Groups</dt>
                <dd className="text-ink">
                  {app.send_groups
                    ? <>Sent as <span className="font-mono text-xs break-all">{app.groups_attribute}</span>, one value per group</>
                    : <span className="text-graphite">Not sent</span>}
                </dd>
              </div>
              <div><dt className="text-mute">Signed</dt><dd className="text-ink">Response and assertion, RSA-SHA256</dd></div>
            </dl>
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex gap-1 px-4 pb-3">
          <button onClick={() => setEditing(true)} className="btn btn-ghost btn-sm"><Pencil size={14} aria-hidden /> Edit</button>
          <button
            onClick={() => confirm(`Remove “${app.name}”? Its SSO URL stops working.`) && remove.mutate()}
            disabled={remove.isPending}
            className="btn btn-danger btn-sm ml-auto"
          >
            <Trash2 size={14} aria-hidden /> Remove
          </button>
        </div>
      )}
    </section>
  );
}

// ─── Signing certificate ─────────────────────────────────────────────────────

function Certificate() {
  const { data } = useQuery({ queryKey: ['saml-idp'], queryFn: async () => (await samlApi.getIdp()).data });
  const [copied, setCopied] = useState(false);
  if (!data) return null;

  const copy = () => {
    navigator.clipboard.writeText(data.certificate);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = `data:application/x-pem-file;charset=utf-8,${encodeURIComponent(data.certificate)}`;

  return (
    <section className="panel px-6 py-5 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="grid place-items-center h-9 w-9 rounded-full bg-chalk text-graphite shrink-0">
          <ShieldCheck size={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="section-title">Signing certificate</h2>
          <p className="font-mono text-[11.5px] text-graphite truncate" title="SHA-256 fingerprint">{data.fingerprint}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={copy} className="btn btn-secondary">
          {copied ? <Check size={15} className="text-ok" aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? 'Copied' : 'Copy PEM'}
        </button>
        <a href={download} download="scimit-idp.pem" className="btn btn-secondary"><Download size={15} aria-hidden /> Download</a>
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function SamlAppsPage() {
  const { data: apps, isLoading, error } = useApps();
  const [adding, setAdding] = useState(false);
  useUrlIntent('new', () => setAdding(true));

  if (isLoading) return <Loading label="Loading SAML apps…" />;
  if (error) return <ErrorState title="Couldn't load SAML apps" detail="Check that the SCIMit server is running." />;

  const count = apps?.length ?? 0;
  return (
    <div>
      <PageHeader
        title="SAML apps"
        meta={`${count} ${count === 1 ? 'app' : 'apps'}`}
        description="SCIMit as a SAML 2.0 identity provider for testing. Add your app’s SP details, give your app the IdP details, then sign in as any SCIMit user. There are no passwords."
        actions={!adding && <button onClick={() => setAdding(true)} className="btn btn-primary"><Plus size={16} aria-hidden /> Add app</button>}
      />
      <div className="page-pad">
        <Certificate />
        {adding && (
          <section className="panel p-6 mb-6">
            <h2 className="section-title mb-4">Add a SAML app</h2>
            <AppForm onDone={() => setAdding(false)} />
          </section>
        )}
        {count > 0 ? (
          <div className="space-y-5">{apps!.map((a) => <AppCard key={a.id} app={a} />)}</div>
        ) : (
          !adding && (
            <EmptyState
              icon={LogIn}
              title="No SAML apps yet"
              action={<button onClick={() => setAdding(true)} className="btn btn-secondary"><Plus size={16} aria-hidden /> Add app</button>}
            >
              Add the app you’re testing with its ACS URL and SP entity ID. SCIMit gives you an SSO URL and metadata to configure it with.
            </EmptyState>
          )
        )}
      </div>
    </div>
  );
}
