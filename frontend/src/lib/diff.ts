// Attribute-level diff of two SCIM resources.
// Paths use SCIM syntax: name.givenName, emails[value eq "a@x.io"].primary, members[value eq "<id>"]
// Multi-valued attributes whose items all have a `value` are matched by value, not by position.

export type Change =
  | { kind: 'added'; path: string; after: unknown }
  | { kind: 'removed'; path: string; before: unknown }
  | { kind: 'changed'; path: string; before: unknown; after: unknown };

const IGNORED_TOP_LEVEL = new Set(['meta']); // version/lastModified always move; not interesting

function flatten(v: unknown, prefix: string, out: Map<string, unknown>) {
  if (Array.isArray(v)) {
    // Empty lists contribute nothing, so emptying one reads as its items being removed
    const keyed = v.every((x) => x && typeof x === 'object' && 'value' in x);
    v.forEach((item, i) => flatten(item, keyed ? `${prefix}[value eq ${JSON.stringify(item.value)}]` : `${prefix}[${i}]`, out));
  } else if (v && typeof v === 'object') {
    const keys = Object.keys(v).filter((k) => !(prefix === '' && IGNORED_TOP_LEVEL.has(k)));
    if (keys.length === 0 && prefix) return void out.set(prefix, {});
    for (const k of keys) flatten((v as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k, out);
  } else {
    out.set(prefix, v);
  }
}

export function diffResources(before: unknown, after: unknown): Change[] {
  const a = new Map<string, unknown>();
  const b = new Map<string, unknown>();
  flatten(before, '', a);
  flatten(after, '', b);
  const paths = [...new Set([...a.keys(), ...b.keys()])].sort();
  const changes: Change[] = [];
  for (const path of paths) {
    if (!a.has(path)) changes.push({ kind: 'added', path, after: b.get(path) });
    else if (!b.has(path)) changes.push({ kind: 'removed', path, before: a.get(path) });
    else if (JSON.stringify(a.get(path)) !== JSON.stringify(b.get(path))) changes.push({ kind: 'changed', path, before: a.get(path), after: b.get(path) });
  }
  return changes;
}

/** The SCIM resource in a response body: the body itself, or the matching item of a ListResponse */
export function resourceOf(body: any, id?: string): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  if (typeof body.id === 'string' && (!id || body.id === id)) return body;
  if (Array.isArray(body.Resources)) return body.Resources.find((r: any) => r?.id && (!id || r.id === id)) ?? null;
  return null;
}
