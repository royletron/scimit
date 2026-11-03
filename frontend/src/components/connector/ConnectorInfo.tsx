import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { JsonBlock } from '../common/JsonBlock';
import { railClass } from '../common/ui';
import { toast, errorText } from '../common/toast';

function CopyField({ label, value, display, children }: { label: string; value: string; display?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="flex gap-2">
        <input type="text" value={display ?? value} readOnly aria-label={label} className="input font-mono text-[13px]" />
        {children}
        <button onClick={copy} className="btn btn-secondary w-24">{copied ? <Check size={15} className="text-ok" aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  );
}

const STEPS = [
  'Open the SCIM provisioning settings for your app in Okta, Entra ID or another IdP.',
  'Paste the SCIM base URL into the tenant or base URL field.',
  'Choose bearer token (OAuth bearer) authentication and paste the token.',
  'Run the IdP’s connection test. The test request appears in Requests.',
  'Turn on provisioning and assign some users or groups.',
];

export function ConnectorInfo() {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);

  const { data: tokenData } = useQuery({
    queryKey: ['token'],
    queryFn: async () => (await adminApi.getToken()).data,
  });

  const regenerate = useMutation({
    mutationFn: () => adminApi.generateToken(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token'] });
      toast.success('New token created', 'The old token no longer works. Update your IdP.');
    },
    onError: (e) => toast.error('Couldn’t create token', errorText(e)),
  });

  const baseUrl = `${window.location.protocol}//${window.location.host}/scim/v2`;
  const token = tokenData?.token || '';
  const masked = token.length > 8 ? `${token.slice(0, 4)}${'•'.repeat(12)}${token.slice(-4)}` : token;

  const curlExample = (t: string) => `# List users
curl -H "Authorization: Bearer ${t}" \\
  ${baseUrl}/Users

# Create a user
curl -X POST -H "Authorization: Bearer ${t}" \\
  -H "Content-Type: application/scim+json" \\
  -d '{"schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],"userName":"test@example.com","active":true}' \\
  ${baseUrl}/Users`;

  const handleRegenerate = () => {
    if (!confirm('Create a new bearer token? The current token stops working immediately, so your IdP will need the new one.')) return;
    regenerate.mutate();
  };

  return (
    <div className="page-pad space-y-10">
      <section className={`panel p-6 pl-7 ${railClass('inbound')}`}>
        <h2 className="section-title">Connection details</h2>
        <p className="hint mt-1 mb-5">Your IdP needs both of these.</p>
        <div className="space-y-4 max-w-3xl">
          <CopyField label="SCIM base URL" value={baseUrl} />
          <CopyField label="Bearer token" value={token} display={showToken ? token : masked}>
            <button onClick={() => setShowToken((s) => !s)} className="btn btn-ghost w-20">{showToken ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />} {showToken ? 'Hide' : 'Show'}</button>
          </CopyField>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button onClick={handleRegenerate} disabled={regenerate.isPending} className="btn btn-secondary btn-sm">
            <KeyRound size={14} aria-hidden /> {regenerate.isPending ? 'Creating token…' : 'Create new token'}
          </button>
        </div>
      </section>

      <section className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          <h2 className="section-title mb-4">Set up your IdP</h2>
          <ol className="space-y-3">
            {STEPS.map((step, i) => (
              <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-2 text-[13.5px] leading-relaxed text-ink">
                <span className="font-mono text-[13px] text-lagoon font-semibold">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="min-w-0">
          <h2 className="section-title mb-1">Try it with curl</h2>
          <p className="hint mb-4">These requests appear in Requests, the same as IdP traffic.</p>
          <JsonBlock data={curlExample(showToken ? token : masked)} copyValue={curlExample(token)} />
        </div>
      </section>
    </div>
  );
}
