// Run: npx tsx src/lib/xml.check.ts
import assert from 'node:assert/strict';
import { tokenizeXml } from '../components/common/JsonBlock';

const xml = '<?xml version="1.0"?>\n<samlp:Response ID="_1" Version=\'2.0\'>\n  <!-- hi -->\n  <saml:Issuer>http://idp</saml:Issuer>\n  <ds:X509Data/>\n</samlp:Response>';
const tokens = tokenizeXml(xml);
assert.equal(tokens.map((t) => t.text).join(''), xml, 'tokens round-trip to the original text');
const of = (type: string) => tokens.filter((t) => t.type === type).map((t) => t.text);
assert.deepEqual(of('tag'), ['samlp:Response', 'saml:Issuer', 'saml:Issuer', 'ds:X509Data', 'samlp:Response']);
assert.deepEqual(of('attr'), ['ID', 'Version']);
assert.deepEqual(of('string'), ['"_1"', "'2.0'"]);
assert.ok(of('punctuation').includes('<!-- hi -->') && of('punctuation').includes('<?xml version="1.0"?>'));
assert.ok(tokens.some((t) => t.type === 'whitespace' && t.text === 'http://idp'), 'text content stays plain');
console.log('xml: all checks passed');
