# Changelog

All notable changes to Opus Flo are documented here. Dates reflect when changes were merged to `main`.

---

## [1.1.0] — 2026-06-16

### Added
- **Import Clients & Projects** — upload a JSON file to bulk-create clients and projects. Modal shows a live preview of what will be created before confirming. Supports optional fields (contact info, project type, status, due date). Includes a downloadable template and clear format documentation. Import button lives in the sidebar Clients header.
- **Drag-and-drop project reassignment** — drag a project from one client and drop it onto another directly in the sidebar. If the project has a NAS folder set, the folder is automatically moved to the target client's directory on disk and the path is updated in the database.
- **Soft-pause timer mode** — by default, pausing a timer now freezes the clock client-side without closing the session. Accumulated pause time is deducted from the logged duration on clock-out, keeping the time log clean. The previous split-session behavior (pause closes session, resume opens a new one) is available as an org feature toggle: **Settings → Features → Pause Creates New Session**.
- **Server deployment docs** — `release/opus-flo-server/README.txt` now documents two remote-access options: Option A (Cloudflare Tunnel — no static IP required) and Option B (Cloud VPS + nginx reverse proxy + Let's Encrypt SSL). Includes a ready-to-use `systemd` service unit and `nginx.conf` example.

### Changed
- Paused timer UI now shows elapsed time (excluding pause) and a Clock Out button so sessions can be ended without resuming first.
- Sidebar small buttons (archive, client dashboard, add project, add client) increased in size for easier clicking.
- Import modal height is responsive — drop zone padding and format hint box shrink on small windows; modal caps at 90 vh and scrolls internally.

### Fixed
- Attached files on tasks were rendering as solid blue bars with no visible filename. Fixed by applying `minWidth: 0` to the flex text container so `text-overflow: ellipsis` works correctly. Applied in both the task detail modal and the Time tab task card.
- Task card in the Time tab was being compressed to a thin line by the flex column layout. Fixed with `flexShrink: 0` and moved to render above the toolbar so it is always visible without scrolling.
- Task files list in the detail modal was capped at 3 visible items with no scroll. Now scrolls with a count shown in the label.

### Security
- `contextIsolation: true` made explicit in Electron `webPreferences`.
- `setWindowOpenHandler` — new windows are blocked; `http://` and `https://` links open in the system browser instead.
- `will-navigate` event handler blocks navigation away from the app origin in both dev and production.
- `setPermissionRequestHandler` denies all OS-level permission requests (camera, microphone, location, etc.).
- Content Security Policy injected via `onHeadersReceived` in production builds.
- OAuth redirect URL validated to be `https:` before calling `shell.openExternal`.

---

## [1.0.5] — 2026-06-11

### Fixed
- Server SQLite database path was resolving relative to the working directory. Anchored to `__dirname` so the DB is always found regardless of where the process is started from.
- `start.bat` now `cd`s to the server directory before launching, fixing startup failures when run from a different location.

---

## [1.0.4] — 2026-06-07

### Fixed
- After a session expired, the app was showing the org setup screen instead of the sign-in screen.
- Navigating to the app after signing in was not working when the session had previously been marked `auth_expired`.
- JWT token TTL extended to 30 days so teams are not prompted to re-authenticate frequently.

---

## [1.0.3] — 2026-06-05

### Added
- Node.js 22 LTS bundled directly in the server release zip (`node.exe`). Windows teams no longer need to install Node separately to run the server.

### Fixed
- `better-sqlite3` native module was compiled for the wrong Node ABI. Now rebuilt automatically on every release build to match the bundled Node version.
- Added a Node version check on server startup with a clear error message if the version is incompatible.
- `dotenv` added to server production dependencies (was missing from the packaged release).

---

## [1.0.2] — 2026-06-03

### Added
- **Task editing while clocked in** — the Time tab now shows the focused task's description, status, priority, and attached files while a timer is running. Status and priority can be edited inline without leaving the Time tab.
- **File management in Time tab** — attach and remove files from the focused task directly from the timer view.
- Setup wizard UI for first-time server connection and org creation.
- Packaging scripts for bundling the server into a distributable zip.
- Server prints its LAN IP address on startup for easier local network setup.
- `README.txt` rewritten to cover both local and NAS install paths.

### Fixed
- Task card file list and task details were loading in a single `Promise.all`, causing the card to show empty if either request failed. Split into independent fetches.
- Subtask pill and session note text were low-contrast in dark mode.
- Unread-only notification filtering — read notifications no longer appear in the bell dropdown.

---

## [1.0.1] — 2026-06-02

### Added
- **Multi-user server architecture** — Opus Flo now runs as a client + server pair. The Electron app connects to a shared Express/SQLite server over HTTP/WebSocket, enabling multiple team members to work from the same dataset simultaneously.
- Real-time updates pushed via WebSocket when projects, tasks, or sessions change.
- Server connection setup screen with URL entry and connection status indicator.
- Reconnecting / disconnected banners shown when the server is unreachable.

---

## [1.0.0] — 2026-05-08

### Added
- **Organizations** — multi-tenant structure; each org has its own clients, projects, and team.
- **Clients & Projects** — hierarchical sidebar with expandable clients, resizable via drag handle.
- **Tasks (Todos)** — phases, priorities, statuses, due dates, recurring tasks, estimated time, and linked files.
- **Task status workflow** — planning → ready for design → in progress → complete, with role-based auto-routing on status change.
- **Time tracking** — clock in/out per project and task, manual session logging, CSV export, hours chart, and time stats breakdown by team member.
- **Time budgets** — set hour budgets on projects; track spend with a visual progress bar (org feature toggle).
- **Task assignments** — assign tasks to team members; notifications sent on assignment and status change.
- **Comments & mentions** — comment on tasks with `@mention` support for team members.
- **Calendar** — month view with Microsoft, Google, Zoom, and CalDAV provider support.
- **Meetings** — link calendar events to projects, attach recordings and notes.
- **File browser** — browse project NAS folder, open files directly from the app.
- **Dark / Light theme** — persisted per device.
- **Gantt chart** — task timeline view based on start and due dates (org feature toggle).
- **Overtime alerts** — notify project managers when a team member exceeds 8 hours in a day (org feature toggle).
- **Invite-based user management** — admin creates accounts with a temporary invite code; users set their own password on first login.
- **Role system** — admin, project manager, creative director, lead designer, designer, developer, marketing, account manager, sales, IT.
- **Archive** — archive and restore clients and projects without deleting data.
- **Dashboard widgets** — per-role configurable dashboard with calendar, task lists, time tracker, deadlines, team workload, and more.
- **Notifications** — in-app bell with unread badge for task assignments, status changes, and mentions.
- **Email notifications** — per-user opt-in for task assigned, task complete, status change, and meeting scheduled events.
- **Recovery codes** — admin can generate a recovery code to regain access if the password is lost.
