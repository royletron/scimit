// Run: npx tsx src/lib/diff.check.ts
import assert from 'node:assert/strict';
import { diffResources, resourceOf } from './diff';

const before = {
  id: 'u1', userName: 'ann', active: true, meta: { version: 'W/"1"' },
  name: { givenName: 'Ann' },
  emails: [{ value: 'a@x.io', primary: true }],
  title: 'Dev',
};
const after = {
  id: 'u1', userName: 'ann', active: false, meta: { version: 'W/"2"' },
  name: { givenName: 'Ann', familyName: 'Lee' },
  emails: [{ value: 'a@x.io', primary: false }, { value: 'b@x.io' }],
};

const changes = diffResources(before, after);
const byPath = Object.fromEntries(changes.map((c) => [c.path, c]));

assert.deepEqual(byPath['active'], { kind: 'changed', path: 'active', before: true, after: false });
assert.equal(byPath['name.familyName']?.kind, 'added');
assert.equal(byPath['title']?.kind, 'removed');
assert.equal(byPath['emails[value eq "a@x.io"].primary']?.kind, 'changed'); // matched by value, not index
assert.equal(byPath['emails[value eq "b@x.io"].value']?.kind, 'added');
assert.ok(!changes.some((c) => c.path.startsWith('meta')), 'meta is ignored');
assert.ok(!byPath['userName'] && !byPath['id'], 'unchanged attributes are not reported');
assert.equal(diffResources(after, after).length, 0);

// group membership: members keyed by value
const g = diffResources({ id: 'g', members: [{ value: 'u1' }, { value: 'u2' }] }, { id: 'g', members: [{ value: 'u2' }, { value: 'u3' }] });
assert.deepEqual(g.map((c) => `${c.kind} ${c.path}`), ['removed members[value eq "u1"].value', 'added members[value eq "u3"].value']);

// emptying a list reads as its items being removed
assert.deepEqual(diffResources({ id: 'g', members: [{ value: 'u1' }] }, { id: 'g', members: [] }).map((c) => c.kind), ['removed']);

assert.equal(resourceOf({ Resources: [{ id: 'x' }, { id: 'y' }] }, 'y')?.id, 'y');
assert.equal(resourceOf({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'] }), null);

console.log('diff: all checks passed');
