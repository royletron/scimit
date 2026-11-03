import { ConnectorInfo } from '../components/connector/ConnectorInfo';
import { PageHeader } from '../components/common/ui';

export function ConnectorPage() {
  return (
    <div>
      <PageHeader
        title="Receive from IdP"
        description="Point Okta, Entra ID or any SCIM 2.0 IdP at SCIMit. Every request it sends is stored and shown in Requests."
      />
      <ConnectorInfo />
    </div>
  );
}
