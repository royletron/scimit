import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Search, TriangleAlert } from 'lucide-react';
import { User } from '../types/scim';
import { postToAcs, samlApi } from '../services/api';
import { useUsers } from '../hooks/useUsers';
import { Badge } from '../components/common/ui';
import { errorText } from '../components/common/toast';

const nameOf = (u: User) =>
  u.rawData?.displayName || [u.rawData?.name?.givenName, u.rawData?.name?.familyName].filter(Boolean).join(' ') || u.userName;

const initials = (u: User) =>
  nameOf(u).split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]!.toUpperCase()).join('');

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-chalk flex flex-col items-center px-4 py-12 md:py-20">
      <div className="flex items-center gap-2 mb-8">
        <span className="text-[26px] leading-none animate-dance" aria-hidden>🕺</span>
        <span className="wordmark text-[22px] text-ink">SCIMit</span>
      </div>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}

/** What the end user sees when an SP sends them to SCIMit to sign in */
export function SsoLoginPage() {
  const { id = '' } = useParams();
  const signIn = useQuery({ queryKey: ['saml-signin', id], queryFn: async () => (await samlApi.getSignIn(id)).data, retry: false });
  const { data: users } = useUsers();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return (users ?? []).filter((u) => `${nameOf(u)} ${u.userName} ${u.emailPrimary}`.toLowerCase().includes(q));
  }, [users, query]);

  const choose = async (u: User) => {
    setBusy(u.id);
    setError(null);
    try {
      postToAcs((await samlApi.completeSignIn(id, u.id)).data); // the browser leaves for the SP here
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  };

  if (signIn.isLoading) return <Shell><p className="text-center hint">Loading…</p></Shell>;
  if (!signIn.data) {
    return (
      <Shell>
        <div className="panel p-6 text-center">
          <h1 className="text-[17px] font-semibold text-ink">This sign-in link has expired</h1>
          <p className="hint mt-2">Sign-in requests last 10 minutes and can only be used once. Start again from the app you were signing in to.</p>
          <Link to="/sign-in" className="btn btn-secondary mt-5">Open SCIMit</Link>
        </div>
      </Shell>
    );
  }

  const { app, warnings, spInitiated, issuer } = signIn.data;
  return (
    <Shell>
      <div className="panel overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">Sign in to {app.name}</h1>
          <p className="hint mt-1.5">Choose who to sign in as. SCIMit is a test identity provider, so there’s no password.</p>
        </div>

        {warnings.map((w, i) => (
          <p key={i} className="mx-6 mb-3 flex gap-2 rounded-md bg-warn-soft text-warn px-3 py-2 text-[12.5px] leading-snug">
            <TriangleAlert size={15} className="shrink-0 mt-px" aria-hidden />{w}
          </p>
        ))}
        {error && <p className="mx-6 mb-3 rounded-md bg-err-soft text-err px-3 py-2 text-[13px]" role="alert">{error}</p>}

        {(users?.length ?? 0) > 6 && (
          <div className="relative mx-6 mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute pointer-events-none" aria-hidden />
            <input
              type="search" autoFocus aria-label="Search users" placeholder="Search by name or email"
              value={query} onChange={(e) => setQuery(e.target.value)} className="input pl-9"
            />
          </div>
        )}

        {users && users.length === 0 ? (
          <div className="px-6 pb-6">
            <p className="hint">There are no users in SCIMit yet.</p>
            <Link to="/users?new=1" target="_blank" className="btn btn-secondary mt-3">Create a user</Link>
          </div>
        ) : (
          <ul className="border-t border-line max-h-[26rem] overflow-y-auto divide-y divide-line">
            {filtered.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => choose(u)}
                  disabled={!u.active || busy !== null}
                  className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-chalk/70 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors group"
                >
                  <span className={`grid place-items-center h-9 w-9 rounded-full text-[12px] font-semibold shrink-0 ${u.active ? 'bg-line text-ink' : 'bg-chalk text-mute'}`}>
                    {initials(u)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[14px] truncate ${u.active ? 'text-ink' : 'text-mute'}`}>{nameOf(u)}</span>
                    <span className="block font-mono text-xs text-graphite truncate">{u.userName}</span>
                  </span>
                  {!u.active ? (
                    <Badge>Inactive</Badge>
                  ) : busy === u.id ? (
                    <span className="text-xs text-graphite">Signing in…</span>
                  ) : (
                    <ChevronRight size={16} className="text-mute group-hover:text-ink transition-colors" aria-hidden />
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-6 py-6 hint">No users match “{query}”.</li>}
          </ul>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-mute">
        {spInitiated ? <>Requested by <span className="font-mono">{issuer ?? app.spEntityId}</span></> : 'Started from SCIMit (IdP-initiated)'}
      </p>
    </Shell>
  );
}
