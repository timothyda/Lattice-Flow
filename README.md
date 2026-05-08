# PM App

A self-hosted project management desktop application built with Electron, React, TypeScript, and SQLite. 
Designed for creative agencies and small teams — manage clients, projects, tasks, time tracking, meetings, 
and calendar events from a single window, with all data stored locally on your machine or server.

Author: Timothy Alden
---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [First Run](#first-run)
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

## Installation

```bash
git clone https://github.com/your-org/pm-app.git
cd pm-app
npm install
```

> **Note for Windows:** After `npm install`, native modules (SQLite, bcrypt) are compiled for the installed Node version. If you see an error like `NODE_MODULE_VERSION mismatch`, run:
> ```bash
> npx @electron/rebuild
> ```

---

## Configuration

All external service credentials are set in a `.env` file in the project root. A template is provided:

```bash
cp .env.example .env
```

Then open `.env` and fill in the values for any services you want to enable. **The app runs without any `.env` values** — calendar sync and email notifications will simply be disabled until configured.

### .env quick reference

```env
# Microsoft Calendar (optional)
AZURE_CLIENT_ID=
AZURE_TENANT_ID=common

# Google Calendar (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Zoom (optional)
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
```

CalDAV calendar servers (Nextcloud, Baikal, etc.) and SMTP email are configured through the in-app Settings after first run — no `.env` entry needed for those.

Full setup instructions for each service are in the [Calendar Integration Setup](#calendar-integration-setup) section below and inside `.env.example`.

---

## First Run

Start the development server:

```bash
npm run dev
```

The first time the app opens, you will be taken through a two-step setup:

### 1. Organization Setup

Enter your organization name, your name, email address, and a password. This creates:
- The organization record in the local database
- The first admin account
- A **recovery code** — save this somewhere safe. It is the only way to recover the admin account if the password is lost.

### 2. Inviting Team Members

Once logged in as admin, go to the **Team** view (people icon in the sidebar) and click **Invite user**. An invite link is generated that the new user visits to set their own password on first login.

> The database is stored at:
> - **Windows:** `%APPDATA%\pm-app\pm-app-v2.db`
> - **macOS:** `~/Library/Application Support/pm-app/pm-app-v2.db`
> - **Linux:** `~/.config/pm-app/pm-app-v2.db`

---

## Features

### Clients & Projects
- Hierarchical sidebar: clients expand to show their projects
- Client dashboard with logo, description, tenure, contact information, and linked projects
- Per-client contacts with roles (separate from the primary contact)
- Archive clients and projects without deleting them

### Tasks
- Tasks belong to projects and optionally to phases within a project
- Status workflow: Planning → Ready for Design → In Progress → Ready for Review → Complete (and more)
- Priority levels, due dates, assignees, and subtasks from templates
- **Role routing** (Settings → Roles): configure which roles are automatically assigned when a task moves to a given status
- **Task templates** (Settings → Task Templates): reusable task lists per project type

### Time Tracking
- Clock in/out against a project or specific task
- Manual session logging
- CSV export per project

### Calendar
- Aggregate view across all connected providers (Microsoft, Google, Zoom, CalDAV)
- Events are color-coded and labeled by source account
- Link any calendar event to a project as a meeting record

### Meetings
- Link calendar events to projects
- Record screen/audio during meetings (requires Whisper + recorder setup)
- Auto-transcription via local Whisper model

### Notifications
- In-app notification bell for task assignments, status changes, and completions
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
2. Name it anything (e.g. "PM App Calendar")
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
4. Platform: **Mobile and desktop applications**
5. Redirect URI: `http://localhost` (the app uses a random port at runtime — register the base URI without a port)
6. After creating, go to **API permissions → Add a permission → Microsoft Graph → Delegated:**
   - `User.Read`
   - `Calendars.Read`
   - `offline_access`
7. Grant admin consent
8. Copy the **Application (client) ID** into `.env`:
   ```env
   AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   AZURE_TENANT_ID=common
   ```

---

### Google Calendar

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Library**
2. Search for and enable **Google Calendar API**
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Application type: **Desktop app**
5. Copy the **Client ID** and **Client secret** into `.env`:
   ```env
   GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxx
   ```
6. In **OAuth consent screen**, add the scope `https://www.googleapis.com/auth/calendar.readonly`

> If your Google Cloud project is in "Testing" mode, add each user's Google account as a test user under **OAuth consent screen → Test users**.

---

### Zoom

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/develop/create) → **General App**
2. In **OAuth** settings, set Redirect URL: `http://localhost`
3. Add scopes: `meeting:read:list_meetings`, `user:read:user`
4. Copy **Client ID** and **Client Secret** into `.env`:
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
| Password | Your account password or an **app password** (recommended) |
| Display label | Optional — e.g. "Work" |

The app performs automatic CalDAV discovery (RFC 6764) — provide the server root URL and it will find your calendars automatically. Alternatively, you can provide a specific calendar URL directly.

> **Nextcloud users:** If your instance has 2FA enabled, create a dedicated app password in Nextcloud → Settings → Security → Devices & sessions.

---

## Email Notifications Setup

Go to **Settings → Email** and enter your SMTP server details. Any standard SMTP server works (SendGrid, Mailgun, Gmail, your own Postfix, Synology MailPlus, etc.).

| Field | Example |
|---|---|
| Host | `smtp.sendgrid.net` |
| Port | `587` |
| Secure (TLS) | On for port 465, Off for 587 |
| Username | `apikey` (SendGrid) or your email |
| Password | SMTP password or API key |
| From name | `PM App` |
| From email | `notifications@yourdomain.com` |

Click **Test Connection** to verify the settings before saving.

Each user can control which notifications they receive in **Settings → Notifications**:
- Task assigned to me
- Task completed
- Status changes
- Meeting scheduled

---

## Meeting Transcription Setup

The transcription feature uses [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) running locally — no cloud service or API key required.

Go to **Settings → Transcription** and follow the status indicators:

1. **Whisper CLI** (`main.exe` on Windows) — click **Import…** to add it
2. **Whisper.dll** — copy `whisper.dll` from the CLI folder into the whisper folder shown at the top of the tab
3. **Whisper model** (`ggml-medium.en.bin`, ~1.5 GB) — click **Import…** to add it, or download from [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp)

Once all three show green, you can record meetings from any project's Meetings tab and transcribe them with one click.

---

## Building a Distributable Package

Build a native installer for the current platform:

```bash
npm run package
```

Output is placed in `dist/`:
- **Windows:** `pm-app-1.0.0-setup.exe` (NSIS installer)
- **macOS:** `.dmg`
- **Linux:** `.AppImage` and `.deb`

To build only (without packaging):

```bash
npm run build
```

> The packaged app uses Electron's `safeStorage` API to encrypt stored credentials (calendar tokens, CalDAV passwords). These are tied to the OS user account and machine — they cannot be transferred between machines by copying the database file.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Electron](https://www.electronjs.org/) 33 |
| Frontend | [React](https://react.dev/) 18 + TypeScript |
| Build tool | [electron-vite](https://electron-vite.org/) + Vite 5 |
| Database | [SQLite](https://www.sqlite.org/) via better-sqlite3 |
| Auth | bcryptjs + Electron safeStorage |
| Email | nodemailer |
| Packaging | electron-builder |
