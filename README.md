# Opus Flo

A self-hosted project management desktop application built with Electron, React, TypeScript, and SQLite.
Designed for creative agencies and small teams — manage clients, projects, tasks, time tracking, meetings,
and calendar events from a single window.

**Multi-user architecture:** a lightweight Node.js server owns the database and runs on your office network or NAS (e.g. Synology via Docker). Each team member runs the Electron client and connects to the shared server over the local network or VPN.

Author: Timothy Alden

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Server Setup](#server-setup)
- [Client Setup](#client-setup)
- [First Run](#first-run)
- [Synology NAS Deployment](#synology-nas-deployment)
- [Features](#features)
- [Calendar Integration Setup](#calendar-integration-setup)
- [Email Notifications Setup](#email-notifications-setup)
- [Meeting Transcription Setup](#meeting-transcription-setup)
- [Building a Distributable Package](#building-a-distributable-package)
- [Tech Stack](#tech-stack)

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20 LTS | Required. Use [nvm-windows](https://github.com/coreybutler/nvm-windows) on Windows |
| npm | Comes with Node | — |
| Git | Any | To clone the repository |

On Windows, install Node 20 via nvm-windows:

```powershell
nvm install 20
nvm use 20
node --version   # should print v20.x.x
```

---

## Architecture Overview

```
┌──────────────────────────────────────────┐
│           Office Network / VPN           │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │    Server  (server/)             │   │
│   │    Node.js + Express + WS        │   │
│   │    Owns opus-flo.db (SQLite)     │   │
│   │    JWT auth  •  Port 3847        │   │
│   └──────────────────────────────────┘   │
│         ▲            ▲           ▲       │
│   [User 1]      [User 2]   [User 3…15]   │
│   Electron      Electron     Electron    │
└──────────────────────────────────────────┘
```

- **Server** — runs once, on a dedicated machine or NAS. Owns the SQLite file and handles all data operations over a REST + WebSocket API with JWT authentication.
- **Client** — the Electron app each team member runs. On first launch it asks for the server URL; after that it connects automatically.

---

## Server Setup

The server lives in the `server/` directory and is a standalone Node.js package.

### 1. Install dependencies

```bash
cd server
npm install
```

> `npm install` compiles `better-sqlite3` for plain Node.js. This is separate from the Electron client's own compilation — both must be installed independently.

### 2. Configure environment

```bash
cp .env.example .env
```

Open `server/.env` and set at minimum:

```env
PORT=3847
DB_PATH=./data/opus-flo.db
JWT_SECRET=replace-with-a-long-random-string
```

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Start the server

**Development (auto-restarts on changes):**

```bash
npm run dev
```

**Production:**

```bash
npm run build
npm start
```

The server creates the database automatically on first run. Verify it's running:

```
GET http://localhost:3847/health
→ { "ok": true }
```

---

## Client Setup

```bash
git clone https://github.com/timothyda/Opus-Flo.git
cd Opus-Flo
npm install
```

`npm install` automatically recompiles native modules (bcrypt) for Electron via the `postinstall` script.

Configure the client `.env` for any optional calendar integrations (see [Calendar Integration Setup](#calendar-integration-setup)):

```bash
cp .env.example .env
```

Start the client:

```bash
npm run dev
```

---

## First Run

### 1. Connect to the server

On first launch the client shows a **"Connect to your organization's server"** screen.

Enter the server URL (e.g. `http://192.168.1.100:3847`) and click **Connect**. The client tests the connection, saves the URL, and proceeds.

> The server URL is stored locally per machine. Each team member enters it once on first launch.

### 2. Organization setup

The first client to connect runs the org setup wizard:

- Organization name
- Admin name, email, and password
- A **recovery code** is generated — save it somewhere safe. It is the only way to recover the admin account if the password is lost.

### 3. Inviting team members

Once logged in as admin, go to the **Team** view (people icon in the sidebar) and click **Invite user**. An invite token is generated that the new user enters on their first login to set their password.

---

## Reconnecting

If the connection is lost, a banner appears at the top of the app:

- **Amber banner** — the client is auto-retrying with exponential backoff (2s → 4s → 8s → … → 60s).
- **Red banner** — retries exhausted. Click **Retry** to try again, or **Change Server URL** to enter a new address.

The server URL can also be changed proactively from the red banner before the connection actually breaks.

---

## Synology NAS Deployment

The server is designed to run as a Docker container on a Synology NAS.

### 1. Install Docker

In Synology DSM, open **Package Center** and install **Container Manager**.

### 2. Create the container

In Container Manager, create a new container from the project image (or build your own — a `Dockerfile` can be added to `server/`):

| Setting | Value |
|---|---|
| Image | Your built image |
| Port | `3847:3847` |
| Volume | `/volume1/opus-flo/data` → `/app/data` |
| Environment | `JWT_SECRET`, `PORT`, `DB_PATH=/app/data/opus-flo.db` |

### 3. HTTPS (recommended)

Use Synology's built-in **Reverse Proxy** (Control Panel → Login Portal → Advanced → Reverse Proxy) with a Let's Encrypt certificate to expose the server over HTTPS. Team members can then connect via `https://your-nas.synology.me:3847` — or over your company VPN for remote access.

### 4. Backups

The entire database is a single file at the volume path you configured. Back it up with Synology's HyperBackup or any standard file backup tool. The server runs SQLite in WAL mode, so the file is safe to copy while the server is running.

---

## Features

### Clients & Projects
- Hierarchical sidebar: clients expand to show their projects
- Client dashboard with logo, description, contact info, and linked projects
- Per-client contacts with roles (separate from the primary contact)
- Archive clients and projects without deleting them

### Tasks
- Tasks belong to projects and optionally to phases within a project
- Status workflow: Planning → Ready for Design → In Progress → Ready for Review → Complete (and more)
- Priority levels, due dates, assignees, and subtasks from templates
- **Role routing** (Settings → Roles): configure which roles are automatically assigned when a task moves to a given status
- **Task templates** (Settings → Task Templates): reusable task lists per project type
- Recurring tasks with configurable frequency

### Time Tracking
- Clock in/out against a project or specific task
- Manual session logging
- CSV export per project

### Calendar
- Aggregate view across all connected providers (Microsoft, Google, Zoom, CalDAV)
- Events are color-coded and labeled by source account
- Link any calendar event to a project as a meeting record

> Calendar accounts are per-machine (OAuth tokens stay on the local device).

### Meetings
- Link calendar events to projects
- Record screen/audio during meetings (requires Whisper + recorder setup)
- Auto-transcription via local Whisper model

### Notifications
- In-app notification bell for task assignments, status changes, and completions
- Real-time updates pushed to all connected clients via WebSocket
- Email notifications via SMTP (Settings → Email / Notifications)
- Per-user opt-in controls for each notification type

### Dashboard
- Customizable widget layout per role
- Widgets: open tasks, completed tasks, calendar, time summary, team workload, upcoming deadlines, org stats, and more

### Settings
| Tab | What it controls |
|---|---|
| Organization | Rename the org |
| Transcription | Import Whisper CLI and model |
| Task Templates | Manage reusable task lists per project type |
| Roles | Configure which roles receive tasks on status change |
| Email | SMTP server configuration |
| Notifications | Per-user email notification preferences |
| Calendar | Connect and manage calendar accounts |

---

## Calendar Integration Setup

Calendar accounts are added per-user in **Settings → Calendar** after logging in. Each account connects independently, and you can have multiple accounts from the same provider.

Events appear in the **Calendar** view, color-coded by source account. Any event can be linked to a project as a meeting record.

---

### Microsoft Calendar

1. Go to [Azure Portal](https://portal.azure.com) → **Entra ID → App registrations → New registration**
2. Name it anything (e.g. "Opus Flo Calendar")
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
4. Platform: **Mobile and desktop applications**
5. Redirect URI: `http://localhost`
6. Go to **API permissions → Add a permission → Microsoft Graph → Delegated:**
   - `User.Read`
   - `Calendars.Read`
   - `offline_access`
7. Grant admin consent
8. Copy the **Application (client) ID** into the client `.env`:
   ```env
   AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   AZURE_TENANT_ID=common
   ```

---

### Google Calendar

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Library**
2. Enable **Google Calendar API**
3. Go to **Credentials → Create Credentials → OAuth client ID**
4. Application type: **Desktop app**
5. Copy into the client `.env`:
   ```env
   GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxx
   ```
6. In **OAuth consent screen**, add scope `https://www.googleapis.com/auth/calendar.readonly`

> If your project is in "Testing" mode, add each user's Google account as a test user.

---

### Zoom

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/develop/create) → **General App**
2. Redirect URL: `http://localhost`
3. Scopes: `meeting:read:list_meetings`, `user:read:user`
4. Copy into the client `.env`:
   ```env
   ZOOM_CLIENT_ID=xxxxxxxxxx
   ZOOM_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

### CalDAV (Nextcloud, Baikal, Radicale, Apple Calendar, Fastmail, etc.)

No `.env` configuration needed. In **Settings → Calendar**, click **Add CalDAV Server** and enter:

| Field | Example |
|---|---|
| Server URL | `https://nextcloud.example.com` |
| Username | `your@email.com` or your username |
| Password | Your account password or an app password (recommended) |
| Display label | Optional — e.g. "Work" |

The app performs automatic CalDAV discovery — provide the server root URL and it will find your calendars automatically.

> **Nextcloud users:** If your instance has 2FA enabled, create a dedicated app password in Nextcloud → Settings → Security → Devices & sessions.

---

## Email Notifications Setup

Go to **Settings → Email** and enter your SMTP server details. Any standard SMTP server works (SendGrid, Mailgun, Gmail, Synology MailPlus, etc.).

| Field | Example |
|---|---|
| Host | `smtp.sendgrid.net` |
| Port | `587` |
| Secure (TLS) | On for port 465, Off for 587 |
| Username | `apikey` (SendGrid) or your email |
| Password | SMTP password or API key |
| From name | `Opus Flo` |
| From email | `notifications@yourdomain.com` |

Click **Test Connection** to verify before saving.

> SMTP configuration is stored locally on each machine. In a future release this will move to the server so only the admin needs to configure it.

---

## Meeting Transcription Setup

The transcription feature uses [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) running locally — no cloud service or API key required.

Go to **Settings → Transcription** and follow the status indicators:

1. **Whisper CLI** (`main.exe` on Windows) — click **Import…** to add it
2. **Whisper.dll** — copy `whisper.dll` from the CLI folder into the whisper folder shown at the top of the tab
3. **Whisper model** (`ggml-medium.en.bin`, ~1.5 GB) — click **Import…** to add it, or download from [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp)

Once all three show green, you can record meetings from any project's Meetings tab and transcribe them with one click.

> Whisper files are stored per machine — each team member who wants transcription sets this up independently.

---

## Building a Distributable Package

Build a native installer for the current platform:

```bash
npm run package
```

Output is placed in `dist/`:
- **Windows:** NSIS installer (`.exe`)
- **macOS:** `.dmg`
- **Linux:** `.AppImage` and `.deb`

Distribute the installer to each team member. They install and run the app, then enter the server URL on first launch.

---

## Tech Stack

### Client (Electron app)

| Layer | Technology |
|---|---|
| Desktop shell | [Electron](https://www.electronjs.org/) 33 |
| Frontend | [React](https://react.dev/) 18 + TypeScript |
| Build tool | [electron-vite](https://electron-vite.org/) + Vite 5 |
| Auth | JWT (stored via Electron safeStorage) |
| Email | nodemailer |
| Packaging | electron-builder |

### Server

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| HTTP | Express 4 |
| Real-time | WebSocket (`ws`) |
| Database | SQLite via better-sqlite3 |
| Auth | bcryptjs + JSON Web Tokens |
| Deployment | Docker (Synology NAS or any Linux host) |
