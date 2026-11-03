// Turns better-sqlite3's "compiled against a different Node.js version" crash into instructions.
// Typical cause: an npx cache populated by one Node version, then run by another.

const ABI_TO_NODE: Record<string, string> = { '115': '20', '127': '22', '131': '23', '137': '24', '141': '25' };

export function explainNativeLoadError(err: any, nodeVersion = process.version): string | null {
  const msg = String(err?.message ?? '');
  if (err?.code !== 'ERR_DLOPEN_FAILED' && !msg.includes('NODE_MODULE_VERSION')) return null;
  if (!msg.includes('better_sqlite3') && !msg.includes('better-sqlite3')) return null;

  const builtFor = msg.match(/NODE_MODULE_VERSION (\d+)\. This version/)?.[1];
  const builtNode = builtFor && ABI_TO_NODE[builtFor] ? `Node ${ABI_TO_NODE[builtFor]}` : 'a different Node.js version';
  const npxDir = msg.match(/([^\s'"]*\/_npx\/[0-9a-f]+)\//)?.[1];

  const fix = npxDir
    ? `This is a stale npx cache. Delete it and try again:\n\n    rm -rf ${npxDir} && npx scimit\n`
    : `Reinstall SCIMit with the Node version you want to run it on:\n\n    npm rebuild -g scimit    (global install)\n    rm -rf ~/.npm/_npx && npx scimit    (npx)\n`;

  return [
    '',
    `  ✖ SCIMit couldn't load its SQLite driver (better-sqlite3).`,
    `    It was built for ${builtNode}, but SCIMit is running on Node ${nodeVersion.replace(/^v/, '')}.`,
    '',
    ...fix.split('\n').map((l) => (l ? `    ${l}` : l)),
    `    If this keeps happening, your npx and node may come from different Node installs: run  type -a node npx`,
    '',
  ].join('\n');
}
