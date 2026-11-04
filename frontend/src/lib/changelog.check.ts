// Run: npx tsx src/lib/changelog.check.ts
// Parses the real CHANGELOG.md and checks it's in step with package.json.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseChangelog } from './changelog';

const sample = parseChangelog(`# Changelog\nintro\n\n## [2.0.0] - 2026-01-02\n### Added\n- One \`code\`\n- Two that\n  wraps\n\n## [1.0.0] - 2025-12-01\n- Loose item\n`);
assert.equal(sample.length, 2);
assert.deepEqual(sample[0], { version: '2.0.0', date: '2026-01-02', sections: [{ title: 'Added', items: ['One `code`', 'Two that wraps'] }] });
assert.deepEqual(sample[1].sections, [{ title: 'Changes', items: ['Loose item'] }]);

const real = parseChangelog(readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
assert.equal(real[0]?.version, pkg.version, `CHANGELOG.md's newest entry should be ${pkg.version}`);
for (const r of real) {
  assert.match(r.date ?? '', /^\d{4}-\d{2}-\d{2}$/, `${r.version} needs a date`);
  assert.ok(r.sections.some((s) => s.items.length), `${r.version} has no entries`);
}
console.log(`changelog: ${real.length} releases parsed, newest ${real[0].version}`);
