import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Read-only value with a Copy button. `display` lets you show a masked value while copying the real one. */
export function CopyField({ label, value, display, children }: { label: string; value: string; display?: string; children?: React.ReactNode }) {
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
