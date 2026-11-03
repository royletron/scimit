import { Fragment, useState } from 'react';
import { revealRow, useUrlIntent } from '../../hooks/useUrlIntent';
import { Plus, Users } from 'lucide-react';
import { Group } from '../../types/scim';
import { JsonBlock } from '../common/JsonBlock';
import { ActivityLogs } from '../common/ActivityLogs';
import { useGroupLogs } from '../../hooks/useAssociatedLogs';
import { EntityPlaybackPicker } from '../playback/PlaybackPicker';
import { ScimEditor } from '../common/ScimEditor';
import { EmptyState, Tabs, formatTime } from '../common/ui';
import { adminApi } from '../../services/api';

type Tab = 'members' | 'activity' | 'raw' | 'edit' | 'push';

function GroupDetail({ group }: { group: Group }) {
  const { data: logs, isLoading } = useGroupLogs(group.id);
  const [tab, setTab] = useState<Tab>('members');

  return (
    <div>
      <Tabs<Tab>
        inset
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'members', label: `Members (${group.members.length})` },
          { id: 'activity', label: 'Activity' },
          { id: 'raw', label: 'SCIM resource' },
          { id: 'edit', label: 'Edit' },
          { id: 'push', label: 'Send to SP' },
        ]}
      />

      {tab === 'members' &&
        (group.members.length > 0 ? (
          <ul className="page-pad grid gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {group.members.map((m) => (
              <li key={m.memberId} className="min-w-0">
                <div className="text-sm text-ink truncate">{m.displayName || 'Unnamed member'}</div>
                <div className="font-mono text-[11px] text-mute truncate">{m.memberId}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="page-pad hint">No members. Add some from the Edit tab.</p>
        ))}

      {tab === 'activity' && <ActivityLogs logs={logs || []} isLoading={isLoading} />}
      <div className="page-pad">
      {tab === 'raw' && <JsonBlock data={group.rawData} />}
      {tab === 'edit' && (
        <div className="panel p-5">
          <ScimEditor
            kind="Group"
            initial={{ ...group.rawData, displayName: group.displayName, members: group.members }}
            onSave={(body) => adminApi.updateGroup(group.id, body)}
            onDone={() => setTab('members')}
            onDelete={() => adminApi.deleteGroup(group.id)}
          />
        </div>
      )}
      {tab === 'push' && (
        <div>
          <p className="hint mb-3 max-w-[68ch]">
            Sends just this group. Members are sent using the SP's IDs, so send the members first (or use Sync all on Send to SP).
          </p>
          <EntityPlaybackPicker entityType="Group" scimitId={group.id} />
        </div>
      )}
      </div>
    </div>
  );
}

export function GroupList({ groups, onCreate }: { groups: Group[]; onCreate: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useUrlIntent('open', (id) => { setExpandedId(id); revealRow(id); });

  if (groups.length === 0) {
    return (
      <div className="page-pad"><EmptyState icon={Users} title="No groups yet" action={<button onClick={onCreate} className="btn btn-secondary"><Plus size={16} aria-hidden /> New group</button>}>
        Groups pushed by your IdP appear here. You can also create one and pick its members.
      </EmptyState></div>
    );
  }

  return (
    <div className="table-wrap"><table className="data-table bleed">
      <thead>
        <tr>
          <th>Group</th>
          <th>Members</th>
          <th className="max-md:hidden">External ID</th>
          <th className="max-md:hidden">Created</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => {
          const open = expandedId === group.id;
          return (
            <Fragment key={group.id}>
              <tr className="row" id={`row-${group.id}`} aria-expanded={open} onClick={() => setExpandedId(open ? null : group.id)}>
                <td className="font-medium text-ink">{group.displayName}</td>
                <td className="font-mono text-[13px] text-graphite">{group.members?.length || 0}</td>
                <td className="max-md:hidden font-mono text-xs text-graphite">{group.externalId || <span className="text-mute">none</span>}</td>
                <td className="max-md:hidden text-[13px] text-graphite whitespace-nowrap">{formatTime(group.createdAt)}</td>
              </tr>
              {open && (
                <tr className="detail">
                  <td colSpan={4}>
                    <GroupDetail group={group} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table></div>
  );
}
