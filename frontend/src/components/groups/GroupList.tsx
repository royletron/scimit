import { useState } from 'react';
import { Group } from '../../types/scim';
import { JsonBlock } from '../common/JsonBlock';
import { ActivityLogs } from '../common/ActivityLogs';
import { useGroupLogs } from '../../hooks/useAssociatedLogs';
import { EntityPlaybackPicker } from '../playback/PlaybackPicker';

interface GroupListProps {
  groups: Group[];
}

function GroupExpandedRow({ group }: { group: Group }) {
  const { data: logs, isLoading } = useGroupLogs(group.id);
  const [tab, setTab] = useState<'members' | 'raw' | 'activity' | 'push'>('activity');

  const tabClass = (t: typeof tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-indigo-500 text-indigo-600'
        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
    }`;

  return (
    <td colSpan={4} className="px-6 py-4 bg-slate-50 border-t border-slate-100">
      <div className="flex border-b border-slate-200 mb-4">
        <button className={tabClass('activity')} onClick={() => setTab('activity')}>Activity</button>
        <button className={tabClass('members')} onClick={() => setTab('members')}>Members</button>
        <button className={tabClass('raw')} onClick={() => setTab('raw')}>Raw SCIM Data</button>
        <button className={tabClass('push')} onClick={() => setTab('push')}>Push to Target</button>
      </div>

      {tab === 'activity' && (
        <ActivityLogs logs={logs || []} isLoading={isLoading} />
      )}

      {tab === 'members' && (
        <div className="space-y-4 text-sm">
          {group.members && group.members.length > 0 ? (
            <ul className="space-y-1">
              {group.members.map((member, idx) => (
                <li key={idx} className="flex items-center gap-2 text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span>{member.displayName || member.memberId}</span>
                  <span className="text-xs text-slate-400">({member.memberType})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-sm">No members</p>
          )}
        </div>
      )}

      {tab === 'raw' && (
        <JsonBlock data={group.rawData} />
      )}

      {tab === 'push' && (
        <div>
          <p className="text-xs text-slate-500 mb-3">Push this group to a playback target. If a mapping exists the target will be updated (PUT), otherwise it will be created (POST). Member IDs will be substituted using existing mappings.</p>
          <EntityPlaybackPicker entityType="Group" scimitId={group.id} />
        </div>
      )}
    </td>
  );
}

export function GroupList({ groups }: GroupListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <table className="min-w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Display Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Members
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              External ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {groups.map((group) => (
            <>
              <tr
                key={group.id}
                onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-3.5 text-sm font-medium text-slate-900">
                  {group.displayName}
                </td>
                <td className="px-6 py-3.5 text-sm text-slate-500">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                    {group.members?.length || 0}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-sm text-slate-500 font-mono">
                  {group.externalId || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-6 py-3.5 text-sm text-slate-500">
                  {new Date(group.createdAt).toLocaleString()}
                </td>
              </tr>
              {expandedId === group.id && (
                <tr>
                  <GroupExpandedRow group={group} />
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      {groups.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">No groups yet</div>
      )}
    </div>
  );
}
