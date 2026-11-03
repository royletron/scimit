import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useGroups } from '../hooks/useGroups';
import { GroupList } from '../components/groups/GroupList';
import { ScimEditor, GROUP_TEMPLATE } from '../components/common/ScimEditor';
import { PageHeader, Loading, ErrorState } from '../components/common/ui';
import { adminApi } from '../services/api';
import { useUrlIntent } from '../hooks/useUrlIntent';

export function GroupsPage() {
  const { data: groups, isLoading, error } = useGroups();
  const [creating, setCreating] = useState(false);
  useUrlIntent('new', () => setCreating(true));

  if (isLoading) return <Loading label="Loading groups…" />;
  if (error) return <ErrorState title="Couldn't load groups" detail="Check that the SCIMit server is running." />;

  const count = groups?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Groups"
        meta={`${count} total`}
        description="Groups and their members, as received from your IdP or created here."
        actions={!creating && <button onClick={() => setCreating(true)} className="btn btn-primary"><Plus size={16} aria-hidden /> New group</button>}
      />
      {creating && (
        <section className="panel p-5 mb-8 mx-[var(--page-x)]">
          <h2 className="section-title mb-4">New group</h2>
          <ScimEditor kind="Group" initial={GROUP_TEMPLATE} onSave={adminApi.createGroup} onDone={() => setCreating(false)} saveLabel="Create group" />
        </section>
      )}
      <GroupList groups={groups || []} onCreate={() => setCreating(true)} />
    </div>
  );
}
