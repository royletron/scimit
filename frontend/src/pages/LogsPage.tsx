import { useLogs } from '../hooks/useLogs';
import { LogList } from '../components/logs/LogList';
import { PageHeader, Loading, ErrorState } from '../components/common/ui';

export function LogsPage() {
  const { data, isLoading, error } = useLogs({ limit: 200 });

  if (isLoading) return <Loading label="Loading requests…" />;
  if (error) return <ErrorState title="Couldn't load requests" detail="Check that the SCIMit server is running." />;

  const total = data?.total ?? 0;
  const shown = data?.logs?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Requests"
        meta={shown < total ? `latest ${shown} of ${total}` : `${total} total`}
        description="Every SCIM request your IdP sent to SCIMit, and every request SCIMit sent to your SPs. New requests appear live."
      />
      <LogList logs={data?.logs || []} />
    </div>
  );
}
