import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';

export function ConnectorInfo() {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: tokenData } = useQuery({
    queryKey: ['token'],
    queryFn: async () => {
      const response = await adminApi.getToken();
      return response.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => adminApi.generateToken(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token'] });
      alert('New token generated successfully');
    },
  });

  const baseUrl = `${window.location.protocol}//${window.location.host}/scim/v2`;
  const token = tokenData?.token || '';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const maskToken = (token: string) => {
    if (token.length <= 8) return token;
    return token.slice(0, 4) + '••••••••' + token.slice(-4);
  };

  const inputClass = "flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none";
  const btnSecondary = "px-3 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors";
  const btnPrimary = "px-3 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors";

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">SCIM Endpoint Configuration</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Base URL
            </label>
            <div className="flex gap-2">
              <input type="text" value={baseUrl} readOnly className={inputClass} />
              <button onClick={() => copyToClipboard(baseUrl, 'url')} className={btnPrimary}>
                {copied === 'url' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Bearer Token
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={showToken ? token : maskToken(token)}
                readOnly
                className={inputClass}
              />
              <button onClick={() => setShowToken(!showToken)} className={btnSecondary}>
                {showToken ? 'Hide' : 'Show'}
              </button>
              <button onClick={() => copyToClipboard(token, 'token')} className={btnPrimary}>
                {copied === 'token' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="pt-1">
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="px-3 py-2 text-sm font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {generateMutation.isPending ? 'Generating…' : 'Generate New Token'}
            </button>
            <p className="mt-1.5 text-xs text-slate-400">
              Generating a new token will invalidate the current one.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Quick Setup Instructions</h2>

        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-slate-700 mb-2">Configure your Identity Provider:</p>
            <ol className="space-y-1.5 text-slate-600">
              {[
                'Navigate to your IDP\'s SCIM provisioning settings (Okta, Entra ID, etc.)',
                'Enter the SCIM Base URL shown above',
                'Set authentication type to "OAuth Bearer Token"',
                'Paste the Bearer Token shown above',
                'Test the connection',
                'Enable provisioning',
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="font-medium text-slate-700 mb-2">Test with cURL:</p>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed">
{`# List users
curl -H "Authorization: Bearer ${token}" \\
  ${baseUrl}/Users

# Create a user
curl -X POST -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"userName":"test@example.com","active":true}' \\
  ${baseUrl}/Users`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
