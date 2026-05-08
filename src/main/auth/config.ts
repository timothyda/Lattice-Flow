// ── Microsoft Calendar ─────────────────────────────────────────────────────────
// Register at https://portal.azure.com → Entra ID → App registrations
//   Platform:      Mobile and desktop applications
//   Redirect URI:  http://localhost (loopback — exact port varies at runtime)
//   API permissions: User.Read, Calendars.Read (delegated), offline_access

export const AZURE_CLIENT_ID = process.env['AZURE_CLIENT_ID'] ?? ''
export const AZURE_TENANT_ID = process.env['AZURE_TENANT_ID'] ?? 'common'

// ── Google Calendar ────────────────────────────────────────────────────────────
// Register at https://console.cloud.google.com → APIs & Services → Credentials
//   App type:      Desktop app
//   Scopes:        https://www.googleapis.com/auth/calendar.readonly
// Note: client_secret is required even for installed/desktop apps (not sensitive for PKCE flows)

export const GOOGLE_CLIENT_ID     = process.env['GOOGLE_CLIENT_ID'] ?? ''
export const GOOGLE_CLIENT_SECRET = process.env['GOOGLE_CLIENT_SECRET'] ?? ''

// ── Zoom ───────────────────────────────────────────────────────────────────────
// Register at https://marketplace.zoom.us/develop/create → OAuth app
//   Redirect URL:  http://localhost (loopback)
//   Scopes:        meeting:read:list_meetings, user:read:user

export const ZOOM_CLIENT_ID     = process.env['ZOOM_CLIENT_ID'] ?? ''
export const ZOOM_CLIENT_SECRET = process.env['ZOOM_CLIENT_SECRET'] ?? ''
