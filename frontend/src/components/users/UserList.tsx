import { useState } from 'react';
import { User } from '../../types/scim';
import { JsonBlock } from '../common/JsonBlock';

interface UserListProps {
  users: User[];
}

export function UserList({ users }: UserListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredUsers = users.filter(user =>
    user.userName.toLowerCase().includes(search.toLowerCase()) ||
    user.emailPrimary?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by username or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="min-w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Username (Email)
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status
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
            {filteredUsers.map((user) => (
              <>
                <tr
                  key={user.id}
                  onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3.5 text-sm font-medium text-slate-900">
                    {user.userName}
                  </td>
                  <td className="px-6 py-3.5 text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
                        user.active
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                          : 'bg-red-50 text-red-700 ring-red-600/20'
                      }`}
                    >
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-slate-500 font-mono">
                    {user.externalId || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-6 py-3.5 text-sm text-slate-500">
                    {new Date(user.createdAt).toLocaleString()}
                  </td>
                </tr>
                {expandedId === user.id && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Raw SCIM Data</p>
                      <JsonBlock data={user.rawData} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            {search ? 'No users match your search' : 'No users yet'}
          </div>
        )}
      </div>
    </div>
  );
}
