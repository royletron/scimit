import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation' | 'whitespace';

const TOKEN_COLORS: Record<TokenType, string> = {
  key:         'text-code-key',
  string:      'text-code-string',
  number:      'text-code-number',
  boolean:     'text-code-number',
  null:        'text-code-number',
  punctuation: 'text-code-punct',
  whitespace:  '',
};

function tokenize(json: string): Array<{ type: TokenType; text: string }> {
  const tokens: Array<{ type: TokenType; text: string }> = [];
  let i = 0;

  while (i < json.length) {
    // Whitespace (batch it)
    if (/\s/.test(json[i])) {
      let j = i;
      while (j < json.length && /\s/.test(json[j])) j++;
      tokens.push({ type: 'whitespace', text: json.slice(i, j) });
      i = j;
      continue;
    }

    // String
    if (json[i] === '"') {
      let j = i + 1;
      while (j < json.length) {
        if (json[j] === '\\') { j += 2; continue; }
        if (json[j] === '"') { j++; break; }
        j++;
      }
      const text = json.slice(i, j);
      // Look ahead past whitespace for a colon to determine if it's a key
      let k = j;
      while (k < json.length && json[k] === ' ') k++;
      tokens.push({ type: json[k] === ':' ? 'key' : 'string', text });
      i = j;
      continue;
    }

    // Number
    if (json[i] === '-' || (json[i] >= '0' && json[i] <= '9')) {
      let j = i;
      if (json[j] === '-') j++;
      while (j < json.length && /[\d.eE+\-]/.test(json[j])) j++;
      tokens.push({ type: 'number', text: json.slice(i, j) });
      i = j;
      continue;
    }

    // Keywords
    if (json.startsWith('true', i))  { tokens.push({ type: 'boolean', text: 'true' });  i += 4; continue; }
    if (json.startsWith('false', i)) { tokens.push({ type: 'boolean', text: 'false' }); i += 5; continue; }
    if (json.startsWith('null', i))  { tokens.push({ type: 'null',    text: 'null' });  i += 4; continue; }

    // Punctuation
    tokens.push({ type: 'punctuation', text: json[i] });
    i++;
  }

  return tokens;
}

interface JsonBlockProps {
  data: unknown;
  /** What the Copy button copies, when it differs from what's shown (e.g. a masked secret) */
  copyValue?: string;
}

export function JsonBlock({ data, copyValue }: JsonBlockProps) {
  const [copied, setCopied] = useState(false);
  const json = (typeof data === 'string' ? data : JSON.stringify(data, null, 2)) ?? 'null';
  const tokens = typeof data === 'string' ? [{ type: 'whitespace' as TokenType, text: data }] : tokenize(json);

  const copy = () => {
    navigator.clipboard.writeText(copyValue ?? json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative group">
      <pre className="bg-code text-code-fg p-4 rounded-lg overflow-x-auto text-[12.5px] leading-[1.65]">
        {tokens.map((token, i) => (
          <span key={i} className={TOKEN_COLORS[token.type]}>
            {token.text}
          </span>
        ))}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium text-[#c4c8d0] bg-white/10 hover:bg-white/20 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
      >
        {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />} {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
