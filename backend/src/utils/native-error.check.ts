// Run: npx tsx src/utils/native-error.check.ts
import assert from 'node:assert/strict';
import { explainNativeLoadError } from './native-error.js';

const real = Object.assign(new Error(
  "The module '/Users/darren/.npm/_npx/4c0cbf014e9da054/node_modules/better-sqlite3/build/Release/better_sqlite3.node'\n" +
  'was compiled against a different Node.js version using\nNODE_MODULE_VERSION 141. This version of Node.js requires\nNODE_MODULE_VERSION 137.'
), { code: 'ERR_DLOPEN_FAILED' });

const out = explainNativeLoadError(real, 'v24.16.0')!;
assert.ok(out.includes('built for Node 25'), out);
assert.ok(out.includes('running on Node 24.16.0'), out);
assert.ok(out.includes('rm -rf /Users/darren/.npm/_npx/4c0cbf014e9da054 && npx scimit'), out);

// global install (no npx path): generic fix
const global = Object.assign(new Error(real.message.replace('/Users/darren/.npm/_npx/4c0cbf014e9da054', '/usr/local/lib')), { code: 'ERR_DLOPEN_FAILED' });
assert.ok(explainNativeLoadError(global, 'v24.16.0')!.includes('npm rebuild -g scimit'));

// unrelated errors pass through untouched
assert.equal(explainNativeLoadError(new Error('SQLITE_CANTOPEN: unable to open database file')), null);
assert.equal(explainNativeLoadError(Object.assign(new Error('other.node failed'), { code: 'ERR_DLOPEN_FAILED' })), null);

console.log(out);
console.log('native-error: all checks passed');
