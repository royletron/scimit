import { ConnectorInfo } from '../components/connector/ConnectorInfo';

export function ConnectorPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Connector Configuration</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use these credentials to configure SCIM provisioning in your Identity Provider.
        </p>
      </div>
      <ConnectorInfo />
    </div>
  );
}
