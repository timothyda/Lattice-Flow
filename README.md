# Opus Flo

A self-hosted project management desktop application for creative agencies and small teams.
Manage clients, projects, tasks, time tracking, meetings, and calendar events from a single window.

**Architecture:** a lightweight Node.js server owns the shared database and runs on your network.
Each team member installs the desktop app and connects to that server.

Author: Timothy Alden

---

## Table of Contents

- [Quick Start](#quick-start)
- [Scenario A — Local / Solo Use](#scenario-a--local--solo-use)
- [Scenario B — Team Server (Office PC or NAS)](#scenario-b--team-server-office-pc-or-nas)
- [First Run — Organization Setup](#first-run--organization-setup)
- [Architecture Overview](#architecture-overview)
- [Features](#features)
- [Calendar Integration Setup](#calendar-integration-setup)
- [Email Notifications Setup](#email-notifications-setup)
- [Meeting Transcription Setup](#meeting-transcription-setup)
- [Developer Setup (from source)](#developer-setup-from-source)
- [Building a Release](#building-a-release)
- [Tech Stack](#tech-stack)

---

## Quick Start

Download both files from the [**GitHub Releases page**](https://github.com/timothyda/Opus-Flo/releases):

| File | What it is |
|---|---|
| `opus-flo-setup.exe` | The desktop app — install on every team member's PC |
| `opus-flo-server.zip` | The server — run once, on a shared machine or your own PC |

Choose your setup:

- **Just me / solo use** → [Scenario A](#scenario-a--local--solo-use) — run everything on your own machine
- **Team of 2–15 people** → [Scenario B](#scenario-b--team-server-office-pc-or-nas) — server on a shared office PC or NAS

---

## Scenario A — Local / Solo Use

Run the server and the desktop app on the same machine. Everything stays local.

### 1. Install Node.js

Download and install **Node.js 22 LTS** from [nodejs.org](https://nodejs.org).

### 2. Set up the server

1. Extract `opus-flo-server.zip` to a permanent folder (e.g. `C:\OpusFlo\server\`)
2. Copy `.env.example` to `.env` and open it in a text editor
3. Change `JWT_SECRET` to any long random string (keep it secret)
4. Double-click `start.bat`

The server window will show:

```
Opus Flo server running on port 3847
DB: ./data/opus-flo.db
```

Keep this window open while using the app.

### 3. Install and open the desktop app

Run `opus-flo-setup.exe` and follow the installer. Open **Opus Flo** from the Start Menu or desktop shortcut.

### 4. Connect

When the app opens it shows the server setup screen. Because the server is on the same machine, click **Skip setup guide** and enter:

```
http://localhost:3847
```

Click **Connect**, then follow the [Organization Setup](#first-run--organization-setup) steps.

> **Auto-start on login (optional):** Right-click `start.bat` → Create shortcut → move to `shell:startup` (`Win + R`, type `shell:startup`). The server will start automatically when you log in to Windows.

---

## Scenario B — Team Server (Office PC or NAS)

One machine runs the server permanently. All team members connect to it over the local network.

### Option 1 — Office PC (Windows, any existing computer)

1. On the **server machine**, install Node.js 22 LTS from [nodejs.org](https://nodejs.org)
2. Extract `opus-flo-server.zip` to a permanent folder (e.g. `C:\OpusFlo\server\`)
3. Copy `.env.example` to `.env` — edit `JWT_SECRET` and optionally `PORT`
4. Run `start.bat` — note the IP address printed:
   ```
   Opus Flo server running on http://192.168.1.42:3847
   ```
5. On each **team member's PC**, install `opus-flo-setup.exe`
6. On first launch, enter `http://192.168.1.42:3847` (use the actual IP from step 4)

**Keep the server running:** use [PM2](https://pm2.keymetrics.io/) to keep the server alive and restart it automatically after reboots:

```bash
npm install -g pm2
cd C:\OpusFlo\server
pm2 start dist/index.js --name opus-flo
pm2 save
pm2 startup
```

---

### Option 2 — Synology NAS (Docker)

> Requires a Synology NAS with Container Manager installed (DSM 7+, most Plus/XS models).

1. **Install Container Manager** — open **Package Center**, search for Container Manager, install it

2. **Transfer the server files** — copy the extracted `opus-flo-server/` folder to your NAS (e.g. `/volume1/opus-flo/`)

3. **Create the container** in Container Manager → Containers → Create:

   | Setting | Value |
   |---|---|
   | Image | `node:20-alpine` |
   | Container name | `opus-flo-server` |
   | Port | `3847 → 3847` (local → container) |
   | Volume | `/volume1/opus-flo/server` → `/app` |
   | Working directory | `/app` |
   | Command | `node dist/index.js` |
   | Environment | `JWT_SECRET=your-secret`, `DB_PATH=/app/data/opus-flo.db`, `PORT=3847` |

4. Start the container. Team members connect to `http://[nas-ip]:3847`

**Backups:** the entire database is a single file at `DB_PATH`. Back it up with Synology HyperBackup or any file-copy tool. It's safe to copy while the server runs (SQLite WAL mode).

**HTTPS (recommended for remote access):** use Synology's built-in **Reverse Proxy** (Control Panel → Login Portal → Advanced → Reverse Proxy) with a Let's Encrypt certificate. Team members can then connect via `https://yourname.synology.me:3847` or through your company VPN.

---

### Option 3 — Linux / Mac server or NAS (without Docker)

Any machine with Node.js 20 works.

```bash
# Extract the zip, then:
cd opus-flo-server
cp .env.example .env
nano .env          # set JWT_SECRET at minimum
node dist/index.js
```

For auto-restart, use PM2:

```bash
npm install -g pm2
pm2 start dist/index.js --name opus-flo
pm2 save && pm2 startup
```

---

## First Run — Organization Setup

After connecting to the server for the first time:

### 1. Organization setup (admin only — done once)

The first person to connect runs the setup wizard:
- Enter your organization name, your name, email, and a password
- A **recovery code** is generated — save it somewhere safe. It is the only way to recover the admin account if the password is lost.

### 2. Invite team members

Once logged in as admin, go to the **Team** view (people icon in the sidebar) → **Invite user**. An invite token is generated. Share it with the new user — they enter it on first login to set their password.

---

## Architecture Overview

```
┌──────────────────────────────────────────┐
│           Office Network / VPN           │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │    Server  (opus-flo-server/)    │   │
│   │    Node.js + Express + WS        │   │
│   │    Owns opus-flo.db (SQLite)     │   │
│   │    JWT auth  •  Port 3847        │   │
│   └──────────────────────────────────┘   │
│         ▲            ▲           ▲       │
│   [User 1]      [User 2]   [User 3…]     │
│   Electron      Electron     Electron    │
└──────────────────────────────────────────┘
```

- **Server** — runs once on a shared machine. Owns the SQLite database and handles all data over a REST + WebSocket API with JWT auth.
- **Client** — the Electron desktop app each user installs. On first launch it asks for the server URL; after that it reconnects automatically.

---

## Features

### Clients & Projects
- Sidebar tree: clients expand to show their projects
- Client dashboard with contacts, description, and linked projects
- Archive clients/projects without deleting them

### Tasks
- Flat task list per project with status, priority, due dates, assignees
- Status workflow: Planning → Ready for Design → In Progress → Ready for Review → Complete
- Multi-file attachments per task
- Task templates per project type; recurring tasks
- Role routing: auto-assign tasks to roles on status change

### Time Tracking
- Clock in/out per project or task; manual logging
- Time budget tracking per project
- CSV export

### Calendar
- Connects to Microsoft, Google, Zoom, and CalDAV accounts
- Week and month views
- Link calendar events to projects as meeting records

### Files
- Per-project file browser (works with any folder/NAS path)
- Drag-and-drop upload; recent files widget
- File attachments linked to tasks

### Notifications
- In-app notification bell (real-time via WebSocket)
- Email notifications via SMTP
- Per-user opt-in controls

### Dark / Light Mode
- Toggle with the ◑ button in the sidebar — preference is saved per machine.

---

## Calendar Integration Setup

Calendar accounts are added per-user in **Settings → Calendar**. Multiple accounts and providers can be connected simultaneously.

### Microsoft Calendar

1. [Azure Portal](https://portal.azure.com) → Entra ID → App registrations → New registration
2. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
3. Platform: **Mobile and desktop applications**, Redirect URI: `http://localhost`
4. API permissions → Add: `User.Read`, `Calendars.Read`, `offline_access` (Delegated)
5. Grant admin consent
6. Copy the **Application (client) ID** into the client `.env`:
   ```env
   AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   AZURE_TENANT_ID=common
   ```

### Google Calendar

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Enable **Google Calendar API**
2. Credentials → Create Credentials → OAuth client ID → **Desktop app**
3. Copy into the client `.env`:
   ```env
   GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxx
   ```
4. OAuth consent screen → add scope `https://www.googleapis.com/auth/calendar.readonly`

> If your project is in "Testing" mode, add each user's Google account as a test user.

### Zoom

1. [Zoom Marketplace](https://marketplace.zoom.us/develop/create) → General App
2. Redirect URL: `http://localhost`, Scopes: `meeting:read:list_meetings`, `user:read:user`
3. Copy into the client `.env`:
   ```env
   ZOOM_CLIENT_ID=xxxxxxxxxx
   ZOOM_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### CalDAV (Nextcloud, Baikal, Fastmail, Apple Calendar, etc.)

No `.env` needed. In **Settings → Calendar**, click **Add CalDAV Server** and enter the server URL, username, and password (use an app password if 2FA is enabled).

---

## Email Notifications Setup

Go to **Settings → Email** and enter your SMTP server details. Any standard SMTP server works (SendGrid, Mailgun, Gmail with App Passwords, Synology MailPlus).

| Field | Example |
|---|---|
| Host | `smtp.sendgrid.net` |
| Port | `587` |
| Username | `apikey` (SendGrid) or your email |
| Password | SMTP password or API key |
| From email | `notifications@yourdomain.com` |

Click **Test Connection** to verify before saving.

---

## Meeting Transcription Setup

Uses [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) running locally — no cloud API required.

Go to **Settings → Transcription** and follow the status indicators:

1. **Whisper CLI** (`main.exe`) — click **Import…** to locate it
2. **Whisper.dll** — copy it from the CLI folder into the whisper folder shown in the tab
3. **Whisper model** (`ggml-medium.en.bin`, ~1.5 GB) — click **Import…** or download from [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp)

Each team member who wants transcription sets this up independently on their own machine.

---

## Developer Setup (from source)

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 LTS — use [nvm-windows](https://github.com/coreybutler/nvm-windows) on Windows |
| Git | Any |

### Server

```bash
cd server
npm install
cp .env.example .env   # edit JWT_SECRET
npm run dev            # starts with auto-reload
```

### Client

```bash
git clone https://github.com/timothyda/Opus-Flo.git
cd Opus-Flo
npm install            # also rebuilds native modules for Electron
cp .env.example .env   # add calendar credentials if needed
npm run dev
```

---

## Building a Release

### Desktop app (Electron installer)

```bash
# From repo root
npm run package
# → dist/opus-flo-1.0.0-setup.exe  (Windows NSIS installer)
# → dist/opus-flo-1.0.0.dmg        (macOS)
```

### Server package (zip)

```powershell
# From repo root (Windows PowerShell)
.\scripts\build-server-release.ps1
# → release/opus-flo-server.zip
```

This script compiles the TypeScript and bundles the output with `node_modules`, `start.bat`, `start.sh`, `.env.example`, and a `README.txt`. Requires Node.js 20 on the machine doing the build.

### GitHub Release checklist

1. Tag the commit: `git tag v1.x.x && git push --tags`
2. Create a new Release on GitHub
3. Attach both files:
   - `opus-flo-setup.exe` (from `dist/`)
   - `opus-flo-server.zip` (from `release/`)

---

## Tech Stack

### Client
| Layer | Technology |
|---|---|
| Desktop shell | Electron 33 |
| Frontend | React 18 + TypeScript |
| Build | electron-vite + Vite |
| Auth | JWT via Electron safeStorage |
| Packaging | electron-builder |

### Server
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| HTTP | Express 4 |
| Real-time | WebSocket (`ws`) |
| Database | SQLite via better-sqlite3 |
| Auth | bcryptjs + JSON Web Tokens |
