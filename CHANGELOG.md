# Changelog

All notable changes to SCIMit. New entries are drafted from `feat:` and `fix:` commits when the version is bumped (see `scripts/changelog.mjs`).

## [1.6.0] - 2026-11-04
### Added
- What's new page listing every SCIMit release. A dot appears in the sidebar when there's one you haven't seen.
- `CHANGELOG.md` entries are drafted automatically from commits when the version is bumped.

## [1.5.1] - 2026-11-03
### Fixed
- The dashboard returned 404 for every page when run with `npx scimit`.
- A clear explanation, with the exact folder to delete, when the SQLite driver was built for a different Node.js version (usually a stale npx cache).
- Server errors are quieter: expected 4xx responses no longer print stack traces, and 5xx errors log one line (set `SCIMIT_DEBUG=1` for the stack).
- Log lines no longer land in the middle of the waiting spinner.

## [1.5.0] - 2026-11-03
### Added
- IdP mode: create users and groups in SCIMit, pick group members, and sync them to your own SCIM service provider.
- Sync all: creates, updates (PATCH or PUT) and deletes users and groups on an SP, in dependency order.
- SCIMit finds resources that already exist on the SP by filter, like Okta and Entra do, instead of creating duplicates.
- Every SP response is checked against RFC 7643/7644, with spec warnings shown next to each result.
- ETag support: SCIMit sends `If-Match` on updates and deletes, and reports 412 conflicts.
- Simple and JSON modes for the user and group editors.
- Changes view for PUT and PATCH requests, showing exactly which attributes changed.
- ⌘K search across users, groups, requests and SPs.
- Dark theme, with Dracula colours for code.
- Live activity: a counter on Requests while you're on another page, and new rows flash in.
- Toast confirmations for every action.

### Changed
- A complete redesign: sidebar navigation, full-width tables, and colour that shows direction (teal for requests received from an IdP, violet for requests sent to an SP).
- Connector is now "Receive from IdP" and Playback is now "Send to SP".
- SCIMit's own SCIM endpoint responds with `application/scim+json` and sends `ETag` headers.

### Fixed
- PATCH operations from Entra ID (capitalised `"Replace"` and `"Add"`) were ignored.
- Filtered PATCH paths such as `emails[type eq "work"].value` crashed with a 500.
- Group PATCH ignored changes to attributes other than members.
- Groups could be returned with a stale member list.
- Requests logged in the same second were listed in random order.
- Timestamps were shown in the wrong time zone outside UTC.
- Responses with `application/scim+json` from an SP weren't read, which caused duplicate creates.

## [1.4.1] - 2026-04-02
### Added
- Replay any captured request, or push any user or group, to a playback target from the dashboard.

## [1.4.0] - 2026-04-02
### Added
- Playback page for managing targets and their ID mappings.

## [1.3.5] - 2026-04-02
### Changed
- Automated release and publishing.

## [1.3.1] - 2026-04-02
### Fixed
- Missing playback types in the dashboard build.

## [1.3.0] - 2026-04-02
### Added
- SCIM relay and playback: register target SCIM services and replay captured requests to them, with automatic ID mapping.

## [1.2.0] - 2026-04-02
### Changed
- The default database location is now `~/.scimit/data.db`.

### Fixed
- The CLI couldn't find its `package.json` when installed globally.

## [1.1.0] - 2026-04-01
### Added
- Activity tab on each user and group, listing every request that touched it.
- Database versioning with automatic migrations between releases.

## [1.0.6] - 2026-02-25
### Changed
- npm packages are published with provenance.

## [1.0.1] - 2026-02-25
### Added
- First public release: a local SCIM 2.0 endpoint that captures what your IdP sends.
- Dashboard listing users, groups and every request, with syntax-highlighted JSON.
- New requests stream into the dashboard live.
- Run it all from one command with `npx scimit`.
- Coloured terminal logging, and a dancing 🕺.
