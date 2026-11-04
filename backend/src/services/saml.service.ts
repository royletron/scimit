import { randomUUID } from 'crypto';
import { Request } from 'express';
import { generate } from 'selfsigned';
import db from '../config/database.js';
import { UserModel } from '../models/user.model.js';
import { broadcast } from './logStream.js';
import { buildIdpMetadata, buildSignedResponse, certFingerprint, NAMEID_FORMATS, parseAuthnRequest, prettyXml } from './saml.js';

export interface SamlApp {
  id: string;
  name: string;
  sp_entity_id: string;
  acs_url: string;
  name_id_format: string;
  name_id_source: 'email' | 'userName' | 'id';
  /** Include group memberships in the assertion (for SPs that JIT-provision and map groups to roles) */
  send_groups: number;
  groups_attribute: string;
  created_at: string;
}

// ─── IdP signing key (created on first use, kept in the database) ─────────────

let idpCache: { privateKey: string; certificate: string } | null = null;

export async function getIdpKeys() {
  if (idpCache) return idpCache;
  const row = db.prepare('SELECT private_key, certificate FROM saml_idp WHERE id = 1').get() as any;
  if (row) return (idpCache = { privateKey: row.private_key, certificate: row.certificate });
  const notAfterDate = new Date();
  notAfterDate.setFullYear(notAfterDate.getFullYear() + 10);
  const pems = await generate([{ name: 'commonName', value: 'SCIMit test IdP' }], { keySize: 2048, algorithm: 'sha256', notAfterDate });
  db.prepare('INSERT OR IGNORE INTO saml_idp (id, private_key, certificate) VALUES (1, ?, ?)').run(pems.private, pems.cert);
  return getIdpKeys();
}

export async function getIdpInfo() {
  const { certificate } = await getIdpKeys();
  return { certificate, fingerprint: certFingerprint(certificate) };
}

// ─── Apps ─────────────────────────────────────────────────────────────────────

type AppInput = Pick<SamlApp, 'name' | 'sp_entity_id' | 'acs_url' | 'name_id_format' | 'name_id_source' | 'groups_attribute'> & { send_groups: boolean };

const FORMATS = new Set<string>(Object.values(NAMEID_FORMATS));
const SOURCES = new Set(['email', 'userName', 'id']);

function validate(input: Partial<AppInput>): AppInput {
  const send_groups = Boolean(input.send_groups);
  const groups_attribute = input.groups_attribute?.trim() || 'groups';
  const name = input.name?.trim();
  const sp_entity_id = input.sp_entity_id?.trim();
  const acs_url = input.acs_url?.trim();
  if (!name || !sp_entity_id || !acs_url) throw Object.assign(new Error('Name, SP entity ID and ACS URL are required'), { status: 400 });
  try {
    new URL(acs_url);
  } catch {
    throw Object.assign(new Error('ACS URL must be a full URL, like https://app.example.com/saml/acs'), { status: 400 });
  }
  const name_id_format = input.name_id_format && FORMATS.has(input.name_id_format) ? input.name_id_format : NAMEID_FORMATS.email;
  const name_id_source = input.name_id_source && SOURCES.has(input.name_id_source) ? input.name_id_source : 'email';
  return { name, sp_entity_id, acs_url, name_id_format, name_id_source, send_groups, groups_attribute };
}

export const SamlApps = {
  all: () => db.prepare('SELECT * FROM saml_apps ORDER BY created_at').all() as SamlApp[],
  get: (id: string) => db.prepare('SELECT * FROM saml_apps WHERE id = ?').get(id) as SamlApp | undefined,
  create(input: Partial<AppInput>) {
    const a = validate(input);
    const id = randomUUID();
    db.prepare('INSERT INTO saml_apps (id, name, sp_entity_id, acs_url, name_id_format, name_id_source, send_groups, groups_attribute) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, a.name, a.sp_entity_id, a.acs_url, a.name_id_format, a.name_id_source, a.send_groups ? 1 : 0, a.groups_attribute);
    return this.get(id)!;
  },
  update(id: string, input: Partial<AppInput>) {
    const a = validate(input);
    db.prepare('UPDATE saml_apps SET name = ?, sp_entity_id = ?, acs_url = ?, name_id_format = ?, name_id_source = ?, send_groups = ?, groups_attribute = ? WHERE id = ?')
      .run(a.name, a.sp_entity_id, a.acs_url, a.name_id_format, a.name_id_source, a.send_groups ? 1 : 0, a.groups_attribute, id);
    return this.get(id);
  },
  remove: (id: string) => db.prepare('DELETE FROM saml_apps WHERE id = ?').run(id).changes > 0,
};

// ─── URLs (as the browser sees them, including through the dev proxy) ─────────

export function baseUrl(req: Request) {
  const proto = (req.get('x-forwarded-proto') ?? req.protocol).split(',')[0].trim();
  const host = (req.get('x-forwarded-host') ?? req.get('host') ?? 'localhost').split(',')[0].trim();
  return `${proto}://${host}`;
}

export const appUrls = (base: string, appId: string) => ({
  entityId: `${base}/saml/apps/${appId}`,
  ssoUrl: `${base}/saml/apps/${appId}/sso`,
  metadataUrl: `${base}/saml/apps/${appId}/metadata.xml`,
});

export async function metadataFor(base: string, app: SamlApp) {
  const { certificate } = await getIdpKeys();
  const { entityId, ssoUrl } = appUrls(base, app.id);
  return buildIdpMetadata({ entityId, ssoUrl, certificate });
}

// ─── Sign-in requests waiting for a user to be chosen ──────────────────────────

interface Pending {
  id: string;
  appId: string;
  base: string;
  requestId: string | null;
  relayState: string | null;
  issuer: string | null;
  warnings: string[];
  expires: number;
}

// ponytail: in-memory with a 10-minute TTL; a restart drops sign-ins that are mid-flight, which is fine for testing
const pending = new Map<string, Pending>();
const TTL = 10 * 60_000;

export function startSignIn(req: Request, app: SamlApp, samlRequest?: string, relayState?: string) {
  for (const [k, p] of pending) if (p.expires < Date.now()) pending.delete(k);

  const base = baseUrl(req);
  const warnings: string[] = [];
  let parsed: ReturnType<typeof parseAuthnRequest> | null = null;
  if (samlRequest) {
    try {
      parsed = parseAuthnRequest(samlRequest);
    } catch (e: any) {
      warnings.push(`The SAMLRequest couldn't be read (${e.message}). Signing in without it.`);
    }
  }
  if (parsed?.issuer && parsed.issuer !== app.sp_entity_id) {
    warnings.push(`The request's Issuer is “${parsed.issuer}”, but this app's SP entity ID is “${app.sp_entity_id}”. The SP may reject the response's Audience.`);
  }
  if (parsed?.acsUrl && parsed.acsUrl !== app.acs_url) {
    warnings.push(`The SP asked for the response at ${parsed.acsUrl}, but this app's ACS URL is ${app.acs_url}. SCIMit uses the configured ACS URL, like a real IdP.`);
  }

  const p: Pending = {
    id: randomUUID(), appId: app.id, base, requestId: parsed?.id ?? null,
    relayState: relayState ?? null, issuer: parsed?.issuer ?? null, warnings, expires: Date.now() + TTL,
  };
  pending.set(p.id, p);

  record({
    method: req.method, path: req.originalUrl.split('?')[0], direction: 'inbound', status: 302,
    query: Object.fromEntries(Object.entries({ RelayState: relayState }).filter(([, v]) => v)),
    body: parsed ? prettyXml(parsed.xml) : null,
    userAgent: req.get('user-agent'), ip: req.ip,
  });
  return p;
}

export const getSignIn = (id: string) => {
  const p = pending.get(id);
  return p && p.expires > Date.now() ? p : undefined;
};

/** Build the signed response for the chosen user. InResponseTo is set when the SP sent an AuthnRequest. */
export async function completeSignIn(app: SamlApp, userId: string, base: string, p: Pending) {
  const user = UserModel.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (!user.active) throw Object.assign(new Error(`${user.user_name} is inactive, so SCIMit won't sign them in`), { status: 403 });

  const raw = JSON.parse(user.raw_data);
  const email = raw.emails?.find((e: any) => e.primary)?.value ?? raw.emails?.[0]?.value ?? user.email_primary ?? user.user_name;
  const groups = !app.send_groups ? [] : (db.prepare(
    'SELECT g.display_name FROM group_members m JOIN groups g ON g.id = m.group_id WHERE m.member_id = ? ORDER BY g.display_name'
  ).all(user.id) as { display_name: string }[]).map((g) => g.display_name);
  const nameId = app.name_id_source === 'id' ? user.id : app.name_id_source === 'userName' ? user.user_name : email;

  const { privateKey, certificate } = await getIdpKeys();
  const xml = buildSignedResponse({
    issuer: appUrls(base, app.id).entityId,
    audience: app.sp_entity_id,
    acsUrl: app.acs_url,
    inResponseTo: p.requestId,
    nameId,
    nameIdFormat: app.name_id_format,
    attributes: {
      email,
      userName: user.user_name,
      firstName: raw.name?.givenName,
      lastName: raw.name?.familyName,
      displayName: raw.displayName,
      ...(app.send_groups ? { [app.groups_attribute]: groups } : {}),
    },
    privateKey,
    certificate,
  });
  pending.delete(p.id);

  record({
    method: 'POST', path: app.acs_url, direction: 'outbound', status: 200, userId: user.id,
    body: prettyXml(xml), // RelayState goes in the form too, but it's not a query string, so it's not shown as one
  });
  return { acsUrl: app.acs_url, SAMLResponse: Buffer.from(xml).toString('base64'), RelayState: p.relayState ?? undefined };
}

// ─── Requests log ─────────────────────────────────────────────────────────────

// SAML traffic shows on Requests next to SCIM: the AuthnRequest as received, and the Response as sent to the ACS
function record(l: {
  method: string; path: string; direction: 'inbound' | 'outbound'; status: number;
  query?: Record<string, unknown>; body: string | null; userId?: string; userAgent?: string; ip?: string;
}) {
  const result = db.prepare(`
    INSERT INTO request_logs (method, path, status_code, headers, query_params, request_body, response_body,
      response_headers, duration_ms, ip_address, user_agent, user_id, direction, timestamp)
    VALUES (?, ?, ?, '{}', ?, ?, NULL, '{}', 0, ?, ?, ?, ?, datetime('now'))
  `).run(l.method, l.path, l.status, JSON.stringify(l.query ?? {}), l.body === null ? null : JSON.stringify(l.body),
    l.ip ?? null, l.userAgent ?? null, l.userId ?? null, l.direction);
  const raw = db.prepare('SELECT * FROM request_logs WHERE id = ?').get(result.lastInsertRowid) as any;
  broadcast({
    ...raw,
    headers: {},
    response_headers: {},
    query_params: JSON.parse(raw.query_params),
    request_body: raw.request_body ? JSON.parse(raw.request_body) : null,
    response_body: null,
  });
}
