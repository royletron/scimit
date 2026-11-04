// Minimal SAML 2.0 IdP building blocks. No database access, so these are easy to check in isolation.
import { randomUUID, X509Certificate } from 'crypto';
import { inflateRawSync } from 'zlib';
import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';

export const NAMEID_FORMATS = {
  email: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  unspecified: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
  persistent: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
} as const;

const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const EXC_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

const esc = (s: unknown) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const instant = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

// ─── AuthnRequest ────────────────────────────────────────────────────────────

export interface AuthnRequest {
  xml: string;
  id: string | null;
  issuer: string | null;
  acsUrl: string | null;
}

/** Decodes a SAMLRequest: HTTP-Redirect binding is deflated + base64, HTTP-POST binding is base64 only. */
export function parseAuthnRequest(encoded: string): AuthnRequest {
  const raw = Buffer.from(encoded, 'base64');
  let xml: string;
  try {
    xml = inflateRawSync(raw).toString('utf8');
  } catch {
    xml = raw.toString('utf8');
  }
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.documentElement;
  if (!root || root.localName !== 'AuthnRequest') throw new Error('SAMLRequest is not an AuthnRequest');
  const issuer = root.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Issuer')[0];
  return {
    xml,
    id: root.getAttribute('ID'),
    issuer: issuer?.textContent?.trim() || null,
    acsUrl: root.getAttribute('AssertionConsumerServiceURL'),
  };
}

// ─── Response ────────────────────────────────────────────────────────────────

export interface ResponseOptions {
  issuer: string;          // IdP entity ID
  audience: string;        // SP entity ID
  acsUrl: string;          // Destination / Recipient
  inResponseTo?: string | null;
  nameId: string;
  nameIdFormat: string;
  attributes: Record<string, string | string[] | undefined>;
  privateKey: string;
  certificate: string;
  now?: Date;
}

/** A Success Response with one Assertion. Both the Assertion and the Response are signed (RSA-SHA256, exclusive c14n). */
export function buildSignedResponse(o: ResponseOptions): string {
  const now = o.now ?? new Date();
  const later = (min: number) => instant(new Date(now.getTime() + min * 60_000));
  const responseId = `_${randomUUID()}`;
  const assertionId = `_${randomUUID()}`;
  const irt = o.inResponseTo ? ` InResponseTo="${esc(o.inResponseTo)}"` : '';

  const attrs = Object.entries(o.attributes)
    .filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([name, v]) =>
      `<saml:Attribute Name="${esc(name)}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">` +
      (Array.isArray(v) ? v : [v]).map((x) => `<saml:AttributeValue xsi:type="xs:string">${esc(x)}</saml:AttributeValue>`).join('') +
      `</saml:Attribute>`
    )
    .join('');

  const xml =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="${responseId}" Version="2.0" IssueInstant="${instant(now)}" Destination="${esc(o.acsUrl)}"${irt}>` +
    `<saml:Issuer>${esc(o.issuer)}</saml:Issuer>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    `<saml:Assertion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema" ` +
    `ID="${assertionId}" Version="2.0" IssueInstant="${instant(now)}">` +
    `<saml:Issuer>${esc(o.issuer)}</saml:Issuer>` +
    `<saml:Subject>` +
    `<saml:NameID Format="${esc(o.nameIdFormat)}">${esc(o.nameId)}</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">` +
    `<saml:SubjectConfirmationData NotOnOrAfter="${later(5)}" Recipient="${esc(o.acsUrl)}"${irt}/>` +
    `</saml:SubjectConfirmation>` +
    `</saml:Subject>` +
    `<saml:Conditions NotBefore="${later(-1)}" NotOnOrAfter="${later(5)}">` +
    `<saml:AudienceRestriction><saml:Audience>${esc(o.audience)}</saml:Audience></saml:AudienceRestriction>` +
    `</saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${instant(now)}" SessionIndex="${assertionId}" SessionNotOnOrAfter="${later(8 * 60)}">` +
    `<saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext>` +
    `</saml:AuthnStatement>` +
    (attrs ? `<saml:AttributeStatement>${attrs}</saml:AttributeStatement>` : '') +
    `</saml:Assertion>` +
    `</samlp:Response>`;

  // Signature goes straight after each element's Issuer, as the schema requires
  const sign = (doc: string, element: 'Assertion' | 'Response') => {
    const target = element === 'Assertion' ? "//*[local-name(.)='Assertion']" : "/*[local-name(.)='Response']";
    const sig = new SignedXml({
      privateKey: o.privateKey,
      publicCert: o.certificate,
      signatureAlgorithm: RSA_SHA256,
      canonicalizationAlgorithm: EXC_C14N,
    });
    sig.addReference({ xpath: target, digestAlgorithm: SHA256, transforms: [ENVELOPED, EXC_C14N] });
    sig.computeSignature(doc, { prefix: 'ds', location: { reference: `${target}/*[local-name(.)='Issuer']`, action: 'after' } });
    return sig.getSignedXml();
  };

  return sign(sign(xml, 'Assertion'), 'Response');
}

// ─── Metadata ────────────────────────────────────────────────────────────────

const certBody = (pem: string) => pem.replace(/-----(BEGIN|END) CERTIFICATE-----|\s/g, '');

export function buildIdpMetadata(o: { entityId: string; ssoUrl: string; certificate: string }): string {
  const formats = Object.values(NAMEID_FORMATS).map((f) => `    <md:NameIDFormat>${f}</md:NameIDFormat>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" entityID="${esc(o.entityId)}">
  <md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certBody(o.certificate)}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>
    </md:KeyDescriptor>
${formats}
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${esc(o.ssoUrl)}"/>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${esc(o.ssoUrl)}"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>
`;
}

export const certFingerprint = (pem: string) => new X509Certificate(pem).fingerprint256;

/** Indented copy of an XML document, for showing in the Requests log (never for signing) */
export function prettyXml(xml: string): string {
  let depth = 0;
  return xml
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((line) => {
      if (line.startsWith('</')) depth--;
      const out = '  '.repeat(Math.max(depth, 0)) + line;
      // an opening tag that isn't self-closing and isn't closed on the same line
      if (/^<[A-Za-z_][^>]*(?<!\/)>/.test(line) && !/<\/[^>]+>$/.test(line)) depth++;
      return out;
    })
    .join('\n');
}
