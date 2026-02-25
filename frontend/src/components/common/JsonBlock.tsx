type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation' | 'whitespace';

const TOKEN_COLORS: Record<TokenType, string> = {
  key:         'text-sky-300',
  string:      'text-emerald-300',
  number:      'text-violet-400',
  boolean:     'text-amber-300',
  null:        'text-slate-500',
  punctuation: 'text-slate-400',
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
}

export function JsonBlock({ data }: JsonBlockProps) {
  const json = JSON.stringify(data, null, 2) ?? 'null';
  const tokens = tokenize(json);

  return (
    <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed">
      {tokens.map((token, i) => (
        <span key={i} className={TOKEN_COLORS[token.type]}>
          {token.text}
        </span>
      ))}
    </pre>
  );
}
