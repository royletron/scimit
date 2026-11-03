import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useUsers } from '../hooks/useUsers';
import { UserList } from '../components/users/UserList';
import { ScimEditor, USER_TEMPLATE } from '../components/common/ScimEditor';
import { PageHeader, Loading, ErrorState } from '../components/common/ui';
import { adminApi } from '../services/api';
import { useUrlIntent } from '../hooks/useUrlIntent';

export function UsersPage() {
  const { data: users, isLoading, error } = useUsers();
  const [creating, setCreating] = useState(false);
  useUrlIntent('new', () => setCreating(true));

  if (isLoading) return <Loading label="Loading users…" />;
  if (error) return <ErrorState title="Couldn't load users" detail="Check that the SCIMit server is running." />;

  const count = users?.length ?? 0;
  const inactive = users?.filter((u) => !u.active).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Users"
        meta={`${count} total${inactive ? `, ${inactive} inactive` : ''}`}
        description="Users your IdP has provisioned into SCIMit, plus any you create here to send to an SP."
        actions={
          !creating && (
            <button onClick={() => setCreating(true)} className="btn btn-primary"><Plus size={16} aria-hidden /> New user</button>
          )
        }
      />
      {creating && (
        <section className="panel p-5 mb-8 mx-[var(--page-x)]">
          <h2 className="section-title mb-4">New user</h2>
          <ScimEditor kind="User" initial={USER_TEMPLATE} onSave={adminApi.createUser} onDone={() => setCreating(false)} saveLabel="Create user" />
        </section>
      )}
      <UserList users={users || []} onCreate={() => setCreating(true)} />
    </div>
  );
}
