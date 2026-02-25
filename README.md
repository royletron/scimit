# 🕺 SCIMmy

**Finally understand what your Identity Provider is actually doing.**

SCIMmy is a local SCIM 2.0 sink that captures, stores, and beautifully displays every provisioning request your IDP fires at you. Point Okta, Entra ID, or any SCIM-compatible IdP at it and watch users, groups, and requests stream in live — with full syntax-highlighted JSON, request/response inspection, and zero infrastructure faff.

> Perfect for debugging SCIM integrations, understanding IDP behaviour, and not losing your mind during provisioning setup.

---

## ✨ What you get

- **Live request streaming** — new SCIM requests appear in the UI the instant they land, no refresh needed
- **Full request/response inspection** — every header, body, and status code, with syntax-highlighted JSON
- **User & group tracking** — see exactly what your IDP has provisioned, with raw SCIM payloads on demand
- **Connector page** — your SCIM base URL and bearer token, one click to copy
- **SCIM 2.0 compliant** — speaks the full protocol: Users, Groups, filters, PATCH operations, the lot
- **SQLite storage** — everything persisted locally, no external dependencies

---

## 🚀 Getting started

### Run with npx (no install)

```bash
npx scimmy
```

Opens everything on **http://localhost:3088** — dashboard, SCIM endpoint, and API all through one port.

```
Options:
  --port, -p  Port to listen on       [default: 3088]
  --db,   -d  Path to SQLite database [default: ~/.scimmy/data.db]
```

```bash
npx scimmy --port 8080 --db /data/scimmy.db
```

### Install globally

```bash
npm install -g scimmy
scimmy
```

### Development (from source)

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

---

## 🔌 Connecting your IDP

Head to the **Connector** page in the UI — it has your SCIM base URL and bearer token ready to copy, plus step-by-step setup instructions.

**SCIM base URL:** `http://your-host:3088/scim/v2`

Quick IDP guides:
- **Okta**: Applications → [Your App] → Provisioning → Integration → Configure API Integration
- **Entra ID**: Enterprise Applications → [Your App] → Provisioning → Tenant URL + Secret Token

> If your IDP is cloud-hosted and can't reach localhost, expose SCIMmy with [localhost.run](https://localhost.run) (`ssh -R 80:localhost:3088 nokey@localhost.run`) or [localtunnel](https://theboroer.github.io/localtunnel-www/) (`npx localtunnel --port 3088`) — both require no account or install.

---

## 🧪 Test with cURL

Grab your token from the Connector page, then:

```bash
# List users
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3088/scim/v2/Users

# Create a user
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/scim+json" \
  -d '{"userName":"test@example.com","active":true}' \
  http://localhost:3088/scim/v2/Users
```

---

## 🏗️ Tech stack

| Layer    | Tech |
|----------|------|
| Backend  | Node.js, Express, TypeScript, better-sqlite3 |
| Frontend | React, Vite, TypeScript, Tailwind CSS v4, TanStack Query |
| Protocol | SCIM 2.0 (RFC 7643 / RFC 7644) |

---

## ⚠️ Heads up

SCIMmy is a **dev/debug tool** — it's not hardened for production. The admin API is unauthenticated by design, so keep it off the public internet.

---

## License

ISC
