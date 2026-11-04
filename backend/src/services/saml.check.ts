// Run: npx tsx src/services/saml.check.ts
// Signs responses with a fresh certificate and validates them with node-saml, a real SP library.
import assert from 'node:assert/strict';
import { generate } from 'selfsigned';
import { SAML } from '@node-saml/node-saml';
import { buildIdpMetadata, buildSignedResponse, certFingerprint, NAMEID_FORMATS, parseAuthnRequest, prettyXml } from './saml.js';

const { private: privateKey, cert: certificate } = await generate([{ name: 'commonName', value: 'SCIMit check' }], {
  keySize: 2048, algorithm: 'sha256',
});

const idp = { entityId: 'http://localhost:3088/saml/apps/app1', ssoUrl: 'http://localhost:3088/saml/apps/app1/sso' };
const sp = { entityId: 'https://sp.example.com', acsUrl: 'https://sp.example.com/acs' };

const spLib = new SAML({
  entryPoint: idp.ssoUrl,
  issuer: sp.entityId,
  callbackUrl: sp.acsUrl,
  audience: sp.entityId,
  idpCert: certificate,
  idpIssuer: idp.entityId,
  wantAssertionsSigned: true,
  wantAuthnResponseSigned: true,
  validateInResponseTo: 'never' as any,
});

const respond = (inResponseTo?: string | null) =>
  Buffer.from(
    buildSignedResponse({
      issuer: idp.entityId, audience: sp.entityId, acsUrl: sp.acsUrl, inResponseTo,
      nameId: 'amara.okafor@acme.io', nameIdFormat: NAMEID_FORMATS.email,
      attributes: { email: 'amara.okafor@acme.io', firstName: 'Amara', lastName: 'O’Kafor & <Co>', groups: ['Engineering', 'Admins'], empty: '' },
      privateKey, certificate,
    })
  ).toString('base64');

// 1. IdP-initiated: a real SP accepts the signed response and reads the profile
const { profile } = await spLib.validatePostResponseAsync({ SAMLResponse: respond() });
assert.equal(profile?.nameID, 'amara.okafor@acme.io');
assert.equal(profile?.nameIDFormat, NAMEID_FORMATS.email);
assert.equal(profile?.issuer, idp.entityId);
assert.equal(profile?.lastName, 'O’Kafor & <Co>', 'attribute values are escaped and round-trip');
assert.deepEqual(profile?.groups, ['Engineering', 'Admins'], 'multi-valued attribute');
assert.equal((profile as any).empty, undefined, 'empty attributes are left out');

// 2. SP-initiated: parse the AuthnRequest the SP library makes (HTTP-Redirect binding), answer it
const redirect = new URL(await spLib.getAuthorizeUrlAsync('relay-123', 'sp.example.com', {}));
const request = parseAuthnRequest(redirect.searchParams.get('SAMLRequest')!);
assert.ok(request.id, 'AuthnRequest ID');
assert.equal(request.issuer, sp.entityId);
assert.equal(request.acsUrl, sp.acsUrl);
const sp2 = await spLib.validatePostResponseAsync({ SAMLResponse: respond(request.id) });
assert.equal(sp2.profile?.inResponseTo, request.id);

// 3. Tampering breaks the signature
const forged = Buffer.from(Buffer.from(respond(), 'base64').toString().replace('amara.okafor@acme.io</saml:NameID>', 'admin@acme.io</saml:NameID>')).toString('base64');
await assert.rejects(spLib.validatePostResponseAsync({ SAMLResponse: forged }), 'a modified assertion must be rejected');

// 4. HTTP-POST binding (plain base64, not deflated) parses too
assert.equal(parseAuthnRequest(Buffer.from(request.xml).toString('base64')).id, request.id);

// 5. Metadata and helpers
const metadata = buildIdpMetadata({ ...idp, certificate });
assert.ok(metadata.includes(`entityID="${idp.entityId}"`) && metadata.includes(`Location="${idp.ssoUrl}"`));
assert.ok(metadata.includes(certificate.split('\n')[1].trim().slice(0, 40)), 'metadata carries the signing certificate');
assert.match(certFingerprint(certificate), /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
assert.equal(prettyXml('<a><b x="1">t</b><c/></a>'), '<a>\n  <b x="1">t</b>\n  <c/>\n</a>');

console.log('saml: all checks passed (validated by node-saml)');
