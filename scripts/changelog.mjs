#!/usr/bin/env node
// Drafts the CHANGELOG.md entry for the version in package.json from commits since the last tag.
// Runs automatically from the `version` lifecycle (npm version …). Edit the draft before pushing if you like.
//   node scripts/changelog.mjs              write the entry (no-op if it already exists)
//   node scripts/changelog.mjs --dry-run    print the entry instead
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const dryRun = process.argv.includes('--dry-run');
const version = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).version;
const file = new URL('CHANGELOG.md', root);
const changelog = readFileSync(file, 'utf8');

if (changelog.includes(`## [${version}]`)) {
  console.log(`changelog: ${version} already has an entry`);
  process.exit(0);
}

const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
// Release tags are created by CI on GitHub, so fetch them first (fine to fail offline)
try { git('fetch --tags --quiet'); } catch { /* offline */ }
// Start from the previous release in CHANGELOG.md; fall back to the nearest tag
const previous = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
let since = '';
try { since = previous ? (git(`rev-parse --verify --quiet v${previous}`), `v${previous}`) : ''; } catch { /* tag not found */ }
if (!since) try { since = git('describe --tags --abbrev=0'); } catch { /* no tags yet: use all history */ }
const log = git(`log ${since ? `${since}..HEAD` : ''} --no-merges --format=%s%x1e`);

// Conventional commits, optionally prefixed with an emoji: "✨ feat(ui): thing"
const SECTION = { feat: 'Added', fix: 'Fixed', perf: 'Changed', refactor: 'Changed' };
const sections = { Added: [], Changed: [], Fixed: [] };
for (const subject of log.split('\x1e').map((s) => s.trim()).filter(Boolean)) {
  const m = subject.match(/^(?:\p{Extended_Pictographic}️?\s*)?(\w+)(?:\([^)]*\))?!?:\s*(.+)$/u);
  const type = m?.[1].toLowerCase();
  if (m && !SECTION[type]) continue; // ci, chore, docs, build, test, style: not user-facing
  const text = (m ? m[2] : subject).replace(/^\w/, (c) => c.toUpperCase());
  sections[m ? SECTION[type] : 'Changed'].push(text.endsWith('.') ? text : `${text}.`);
}

const date = new Date().toISOString().slice(0, 10);
const body = Object.entries(sections)
  .filter(([, items]) => items.length)
  .map(([title, items]) => `### ${title}\n${items.map((i) => `- ${i}`).join('\n')}`)
  .join('\n\n') || '### Changed\n- Maintenance release.';
const entry = `## [${version}] - ${date}\n${body}\n\n`;

if (dryRun) {
  process.stdout.write(entry);
} else {
  const at = changelog.indexOf('\n## ');
  writeFileSync(file, at === -1 ? `${changelog.trimEnd()}\n\n${entry}` : changelog.slice(0, at + 1) + entry + changelog.slice(at + 1));
  console.log(`changelog: drafted ${version} from ${since || 'the start'}..HEAD`);
}
