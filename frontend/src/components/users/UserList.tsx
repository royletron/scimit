import { Fragment, useState } from 'react';
import { revealRow, useUrlIntent } from '../../hooks/useUrlIntent';
import { Plus, Search, User as UserIcon } from 'lucide-react';
import { User } from '../../types/scim';
import { JsonBlock } from '../common/JsonBlock';
import { ActivityLogs } from '../common/ActivityLogs';
import { useUserLogs } from '../../hooks/useAssociatedLogs';
import { EntityPlaybackPicker } from '../playback/PlaybackPicker';
import { ScimEditor } from '../common/ScimEditor';
import { Badge, EmptyState, Tabs, formatTime } from '../common/ui';
import { adminApi } from '../../services/api';
import { useGroups } from '../../hooks/useGroups';

type Tab = 'activity' | 'raw' | 'edit' | 'push';

function UserDetail({ user }: { user: User }) {
  const { data: logs, isLoading } = useUserLogs(user.id);
  const [tab, setTab] = useState<Tab>('activity');

  return (
    <div>
      <Tabs<Tab>
        inset
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'activity', label: 'Activity' },
          { id: 'raw', label: 'SCIM resource' },
          { id: 'edit', label: 'Edit' },
          { id: 'push', label: 'Send to SP' },
        ]}
      />
      {tab === 'activity' && <ActivityLogs logs={logs || []} isLoading={isLoading} />}
      <div className="page-pad">
      {tab === 'raw' && <JsonBlock data={user.rawData} />}
      {tab === 'edit' && (
        <div className="panel p-5">
          <ScimEditor
            kind="User"
            resourceId={user.id}
            initial={user.rawData}
            onSave={(body) => adminApi.updateUser(user.id, body)}
            onDone={() => setTab('raw')}
            onDelete={() => adminApi.deleteUser(user.id)}
          />
        </div>
      )}
      {tab === 'push' && (
        <div>
          <p className="hint mb-3 max-w-[68ch]">
            Sends just this user. If the SP already has it, SCIMit updates it with PUT; otherwise it creates it with POST.
          </p>
          <EntityPlaybackPicker entityType="User" scimitId={user.id} />
        </div>
      )}
      </div>
    </div>
  );
}

function GroupNames({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-[13px] text-mute">none</span>;
  const shown = names.slice(0, 2);
  return (
    <span className="flex flex-wrap items-center gap-1" title={names.join(', ')}>
      {shown.map((n) => <Badge key={n}>{n}</Badge>)}
      {names.length > shown.length && <span className="text-xs text-graphite">+{names.length - shown.length}</span>}
    </span>
  );
}

const displayNameOf = (u: User) =>
  u.rawData?.displayName ||
  [u.rawData?.name?.givenName, u.rawData?.name?.familyName].filter(Boolean).join(' ') ||
  null;

export function UserList({ users, onCreate }: { users: User[]; onCreate: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useUrlIntent('open', (id) => { setExpandedId(id); revealRow(id); });
  const [search, setSearch] = useState('');
  const { data: groups } = useGroups();
  const groupsOf = (id: string) => (groups ?? []).filter((g) => g.members.some((m) => m.memberId === id)).map((g) => g.displayName);

  if (users.length === 0) {
    return (
      <div className="page-pad"><EmptyState
        icon={UserIcon}
        title="No users yet"
        action={<button onClick={onCreate} className="btn btn-secondary"><Plus size={16} aria-hidden /> New user</button>}
      >
        Point your IdP at the address on <a href="/connector" className="underline underline-offset-2 hover:text-ink">Receive from IdP</a>, or create a user here to send to an SP.
      </EmptyState></div>
    );
  }

  const q = search.toLowerCase();
  const filtered = users.filter(
    (u) =>
      u.userName.toLowerCase().includes(q) ||
      u.emailPrimary?.toLowerCase().includes(q) ||
      displayNameOf(u)?.toLowerCase().includes(q)
  );

  return (
    <div>
      <div className="page-pad mb-4"><div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute pointer-events-none" aria-hidden />
        <input
          type="search"
          aria-label="Search users"
          placeholder="Search by name, username or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div></div>

      <div className="table-wrap"><table className="data-table bleed">
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th className="max-md:hidden">Groups</th>
            <th className="max-md:hidden">External ID</th>
            <th className="max-md:hidden">Created</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((user) => {
            const open = expandedId === user.id;
            const name = displayNameOf(user);
            return (
              <Fragment key={user.id}>
                <tr className="row" id={`row-${user.id}`} aria-expanded={open} onClick={() => setExpandedId(open ? null : user.id)}>
                  <td>
                    <div className="font-medium text-ink">{name ?? user.userName}</div>
                    {name && <div className="font-mono text-xs text-graphite mt-0.5">{user.userName}</div>}
                  </td>
                  <td>
                    {user.active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
                  </td>
                  <td className="max-md:hidden"><GroupNames names={groupsOf(user.id)} /></td>
                  <td className="max-md:hidden font-mono text-xs text-graphite">{user.externalId || <span className="text-mute">none</span>}</td>
                  <td className="max-md:hidden text-[13px] text-graphite whitespace-nowrap">{formatTime(user.createdAt)}</td>
                </tr>
                {open && (
                  <tr className="detail">
                    <td colSpan={5}>
                      <UserDetail user={user} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table></div>
      {filtered.length === 0 && <p className="page-pad py-10 text-center hint">No users match “{search}”.</p>}
    </div>
  );
}
