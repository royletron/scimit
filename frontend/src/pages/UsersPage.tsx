import { useUsers } from '../hooks/useUsers';
import { UserList } from '../components/users/UserList';

export function UsersPage() {
  const { data: users, isLoading, error } = useUsers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
        <svg className="animate-spin h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading users…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-red-500 text-sm gap-2">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Error loading users
      </div>
    );
  }

  const count = users?.length ?? 0;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-semibold text-slate-900">Users</h2>
          <span className="text-sm text-slate-400">{count} {count === 1 ? 'user' : 'users'}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          All SCIM users provisioned from your Identity Provider. Click a row to view raw SCIM data.
        </p>
      </div>
      <UserList users={users || []} />
    </div>
  );
}
