# 🕺 SCIMit

**Finally understand what your Identity Provider is actually doing — and test your own SCIM service like a real IdP would.**

SCIMit is a local SCIM 2.0 workbench that works in both directions:

- **Receive from an IdP.** Point Okta, Entra ID or any SCIM-compatible IdP at SCIMit and watch users, groups and requests stream in live, with every header and body on hand.
- **Send to an SP.** Create users and groups in SCIMit, then sync them to the SCIM service you're building. SCIMit provisions it the way Okta and Entra do, and checks every response against the spec.

> Perfect for debugging SCIM integrations, understanding IdP behaviour, testing your own SCIM endpoint, and not losing your mind during provisioning setup.

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

Inside this repo, `npx scimit` won't work (npx resolves to the local project). Use `npm start` after a build.

Quick checks, no test framework needed:

```bash
npx tsx frontend/src/lib/diff.check.ts            # Changes view diffing
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

| Layer    | Tech |
|----------|------|
| Backend  | Node.js, Express, TypeScript, better-sqlite3 |
| Frontend | React, Vite, TypeScript, Tailwind CSS v4, TanStack Query, Lucide icons, Recursive typeface |
| Protocol | SCIM 2.0 (RFC 7643 / RFC 7644) |

---

## ⚠️ Heads up

SCIMit is a **dev/debug tool** — it's not hardened for production. The admin API is unauthenticated by design, so keep it off the public internet.

---

## License

ISC
