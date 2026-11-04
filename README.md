# 🕺 SCIMit

**Finally understand what your Identity Provider is actually doing — and test your own app like a real IdP would.**

SCIMit is a local SCIM 2.0 and SAML workbench:

- **Receive from an IdP.** Point Okta, Entra ID or any SCIM-compatible IdP at SCIMit and watch users, groups and requests stream in live, with every header and body on hand.
- **Send to an SP.** Create users and groups in SCIMit, then sync them to the SCIM service you're building. SCIMit provisions it the way Okta and Entra do, and checks every response against the spec.
- **Sign in with SAML.** SCIMit is also a SAML 2.0 identity provider. Point your app at it and sign in as any SCIMit user, no passwords.

> Perfect for debugging SCIM integrations, understanding IdP behaviour, testing your own SCIM endpoint and SAML login, and not losing your mind during provisioning setup.

---

## ✨ What you get

**Receive from your IdP**
- **Live request streaming** — new requests appear the instant they land, no refresh needed
- **Full request/response inspection** — every header, body and status code, with syntax-highlighted JSON
- **Changes view** — for every PUT and PATCH, exactly which attributes were added, changed or removed
- **User & group tracking** — see what your IdP has provisioned, with each resource's full request history
- **SCIM 2.0 compliant** — Users, Groups, filters, PATCH (including Entra's filtered paths), ETags, the lot

**Send to your SP**
- **Author test data** — create users and groups with a simple form or raw JSON, and pick group members
- **Sync all** — creates, updates (PATCH or PUT) and deletes everything on your SP, in the right order
- **Behaves like a real IdP** — looks resources up by filter before creating them, tracks the SP's IDs, and sends `If-Match` for versioned updates
- **Spec checks** — every SP response is checked against RFC 7643/7644, with warnings shown next to each result

**Sign in with SAML**
- **SAML 2.0 IdP** — add your app, give it SCIMit's metadata URL (or download `metadata.xml`), and sign in as any user
- **SP- and IdP-initiated** — HTTP-Redirect and HTTP-POST bindings, `RelayState`, signed responses and assertions
- **Groups in the assertion** — optional, with the attribute name your app expects, for JIT provisioning and role mapping
- **Every exchange logged** — the AuthnRequest received and the Response sent, with XML highlighting

**Around the dashboard**
- **⌘K search** across users, groups, requests and SPs
- **Dark theme** (with Dracula colours for code), toasts for every action, and a **What's new** page
- **SQLite storage** — everything persisted locally, no external dependencies

---

## 🚀 Getting started

### Run with npx (no install)

```bash
npx scimit
```

Opens everything on **http://localhost:3088** — dashboard, SCIM endpoint and API all through one port.

```
Options:
  --port, -p  Port to listen on       [default: 3088]
  --db,   -d  Path to SQLite database [default: ~/.scimit/data.db]
```

```bash
npx scimit --port 8080 --db /data/scimit.db
```

### Install globally

```bash
npm install -g scimit
scimit
```

---

## 🔌 Receive from your IdP

Open **Receive from IdP** in the dashboard. It has your SCIM base URL and bearer token ready to copy, plus setup steps.

**SCIM base URL:** `http://your-host:3088/scim/v2`

Quick IdP guides:
- **Okta**: Applications → [Your App] → Provisioning → Integration → Configure API Integration
- **Entra ID**: Enterprise Applications → [Your App] → Provisioning → Tenant URL + Secret Token

> If your IdP is cloud-hosted and can't reach localhost, expose SCIMit with [localhost.run](https://localhost.run) (`ssh -R 80:localhost:3088 nokey@localhost.run`) or [localtunnel](https://theboroer.github.io/localtunnel-www/) (`npx localtunnel --port 3088`) — both require no account or install.

### Test with cURL

Grab your token from **Receive from IdP**, then:

```bash
# List users
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3088/scim/v2/Users

# Create a user
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/scim+json" \
  -d '{"schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],"userName":"test@example.com","active":true}' \
  http://localhost:3088/scim/v2/Users
```

---

## 📤 Send to your SP

Use SCIMit as the IdP when you're building a SCIM service provider.

1. **Create test data.** On **Users** and **Groups**, choose **New user** / **New group**. Use **Fields** for the common attributes, or **JSON** for anything else (enterprise extension, custom attributes). Groups have a member picker.
2. **Add your SP.** On **Send to SP**, choose **Add SP** and enter its SCIM base URL and bearer token.
3. **Sync all.** SCIMit pushes every user, then every group, then deletes anything you've removed locally. Choose whether updates are sent with **PATCH** (like Okta and Entra) or **PUT**.

What SCIMit sends, per resource:

| Situation | Request |
|---|---|
| Never synced | `GET /Users?filter=userName eq "…"` to find an existing match, then `POST` if there isn't one |
| Changed since the last sync | `PATCH` with only the changed attributes (or a full `PUT`), with `If-Match` when the SP gave a version |
| Unchanged | Nothing |
| Deleted in SCIMit | `DELETE` |

Each result lists any spec problems in the SP's response: a wrong `Content-Type`, `POST` not returning `201` with an `id` and `Location`, a missing `ListResponse` schema, a filter that returned the wrong resources, error bodies without the SCIM error schema, and so on. Full requests and responses are on **Requests**, marked as sent rather than received.

You can also send a single user or group from its **Send to SP** tab, or replay any captured request to an SP.

---

## 🔐 Sign in with SAML

Use SCIMit as the SAML identity provider while you build your app's SSO. It's for testing only: there are no passwords, you just pick a user.

1. **Add an app.** On **SAML apps**, choose **Add app** and enter your app's **ACS URL** (where SAML responses are posted) and **SP entity ID**. Choose the NameID format and value, and tick **Send group memberships** if your app maps groups to roles.
2. **Configure your app.** Give it the app's **metadata URL** (`…/saml/apps/<id>/metadata.xml`), or download `metadata.xml` and upload it. If your app wants the values one by one, the SSO URL, IdP entity ID and signing certificate are all on the same card.
3. **Sign in.** Start from your app (SP-initiated), or choose **Sign in as a user** in SCIMit (IdP-initiated). Either way you get a list of SCIMit users. Pick one and you're sent back to your app, signed in. Inactive users can't sign in.

What's in the assertion:

| | |
|---|---|
| NameID | Primary email, username or SCIMit user ID, as email address, unspecified or persistent format |
| Attributes | `email`, `userName`, `firstName`, `lastName`, `displayName`, plus groups if enabled (one value per group, by display name) |
| Signing | Response and assertion, RSA-SHA256 with exclusive canonicalisation, using a certificate SCIMit creates on first run |
| Validity | 5 minutes, with `InResponseTo` set when your app sent an AuthnRequest |

SCIMit warns on the sign-in page if your app's AuthnRequest names a different SP entity ID, or asks for a different ACS URL, than the app you set up.

---

## 🛠️ Development (from source)

```bash
npm install
npm run dev    # backend on :3000, frontend on :5173 (Vite proxy)
npm run build  # compiles everything to dist/
```

| Service  | URL |
|----------|-----|
| Dashboard (dev) | http://localhost:5173 |
| Dashboard (built) | http://localhost:3088 |
| Backend (dev, internal) | http://localhost:3000 |

pnpm works too: `pnpm install && pnpm dev`. CI uses npm, so add new packages with npm (or keep `package-lock.json` in step).

Inside this repo, `npx scimit` won't work (npx resolves to the local project). Use `npm start` after a build.

Quick checks, no test framework needed:

```bash
npx tsx frontend/src/lib/diff.check.ts            # Changes view diffing
npx tsx frontend/src/lib/xml.check.ts             # XML syntax highlighting
npx tsx backend/src/services/saml.check.ts        # SAML responses, validated by a real SP library
npx tsx frontend/src/lib/changelog.check.ts       # CHANGELOG.md is valid and matches package.json
npx tsx backend/src/utils/native-error.check.ts   # SQLite driver error message
```

### Releasing

```bash
npm version minor --no-git-tag-version --workspaces=false   # or patch / major
git commit -am "chore: release x.y.z" && git push
```

Bumping the version drafts a `CHANGELOG.md` entry from the `feat:` and `fix:` commits since the last tag (edit it before committing if you like). It appears in the dashboard under **What's new**. Pushing to `main` tags the release, creates the GitHub release and publishes to npm.

---

## 🩺 Troubleshooting

**`was compiled against a different Node.js version`** — SCIMit's SQLite driver was installed by a different Node version than the one running it, usually a stale npx cache. SCIMit prints the exact folder to delete; or clear the whole cache with `rm -rf ~/.npm/_npx && npx scimit`.

**Seeing a server error?** SCIMit logs one line per failure. Run with `SCIMIT_DEBUG=1 npx scimit` to see stack traces.

---

## 🏗️ Tech stack

| Layer     | Tech |
|----------|------|
| Backend  | Node.js, Express, TypeScript, better-sqlite3, xml-crypto (SAML signing) |
| Frontend | React, Vite, TypeScript, Tailwind CSS v4, TanStack Query, Lucide icons, Recursive typeface |
| Protocols | SCIM 2.0 (RFC 7643 / RFC 7644), SAML 2.0 |

---

## ⚠️ Heads up

SCIMit is a **dev/debug tool** — it's not hardened for production. The admin API is unauthenticated by design, and anyone who can reach SCIMit can sign in to your SAML apps as any user. Keep it off the public internet, and never trust its signing certificate in production.

---

## License

ISC
