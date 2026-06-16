# Opus Flo Server

## Requirements (Windows)
  None — Node.js v22 is bundled. Just extract and run start.bat.

## Requirements (Mac / Linux)
  Node.js 22 LTS  (https://nodejs.org)

## Setup (first time only)
  1. Copy .env.example to .env
  2. Open .env in a text editor and set JWT_SECRET to a long random string
     Generate one: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  3. Run start.bat (Windows) or  sh start.sh  (Mac/Linux)

## Running
  Windows:    double-click start.bat
  Mac/Linux:  sh start.sh
  Default port: 3847  (change PORT= in .env)

Pick the deployment option that fits your team:

─────────────────────────────────────────────────────────────────────
OPTION A — Office / Home Machine + Cloudflare Tunnel
Use when: server runs on an existing PC and remote workers need access
─────────────────────────────────────────────────────────────────────

Cloudflare Tunnel gives a stable HTTPS URL even when your public IP
changes. No port forwarding or firewall rules required.

  1. Download cloudflared:
       Windows / Mac / Linux: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

  2. Quick tunnel (good for testing — URL changes on each restart):
       cloudflared tunnel --url http://localhost:3847
     Cloudflare prints a URL like:  https://random-words.trycloudflare.com
     Enter that in the Opus Flo app on every device.

  3. Permanent named tunnel (recommended for ongoing use):
       cloudflared login
       cloudflared tunnel create opus-flo
       cloudflared tunnel route dns opus-flo yourteam.yourdomain.com
       cloudflared tunnel run --url http://localhost:3847 opus-flo
     Enter  https://yourteam.yourdomain.com  in the Opus Flo app.
     This URL never changes — set it once on each device and forget it.

  4. Auto-start the tunnel on Windows login (named tunnel only):
     Open an Administrator command prompt and run:
       cloudflared service install
     The tunnel now starts automatically with Windows alongside the server.

  Auto-start the server itself on Windows login:
     1. Right-click start.bat > Create shortcut
     2. Press Win+R, type  shell:startup, press Enter
     3. Move the shortcut into that folder

─────────────────────────────────────────────────────────────────────
OPTION B — Cloud VPS
Use when: you want the server always on, independent of office hardware
─────────────────────────────────────────────────────────────────────

A small VPS (~$5-6/month) gives a static IP, 24/7 uptime, and no
dependency on anyone's PC being switched on.
Recommended providers: Hetzner, DigitalOcean, Vultr, Linode
Recommended OS: Ubuntu 22.04 LTS

  1. Create a VPS and note its public IP address.

  2. SSH in and install Node.js 22:
       curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
       sudo apt install -y nodejs

  3. Upload the server files:
       scp -r ./* user@YOUR_VPS_IP:/opt/opus-flo-server/

  4. Configure the environment on the VPS:
       cd /opt/opus-flo-server
       cp .env.example .env
       nano .env        # set JWT_SECRET and DB_PATH

  5. Test it starts correctly:
       sh start.sh

  6. Install as a systemd service (auto-starts on reboot):
       sudo cp opus-flo.service.example /etc/systemd/system/opus-flo.service
       # Edit the file if your paths differ from /opt/opus-flo-server
       sudo systemctl daemon-reload
       sudo systemctl enable --now opus-flo
     Check status:  sudo systemctl status opus-flo
     View logs:     sudo journalctl -u opus-flo -f

  7. Open the firewall:
       sudo ufw allow 3847/tcp && sudo ufw enable

  8. Enter  http://YOUR_VPS_IP:3847  in the Opus Flo app on each device.

  ── Optional: HTTPS with your own domain name ──────────────────────

  Required if you want a proper domain (e.g. yourteam.yourdomain.com)
  and encrypted connections (recommended for remote teams).

  a. Add a DNS A record pointing yourteam.yourdomain.com → YOUR_VPS_IP

  b. Install nginx and certbot:
       sudo apt install -y nginx certbot python3-certbot-nginx

  c. Copy the nginx config example and edit your domain name:
       sudo cp nginx.conf.example /etc/nginx/sites-available/opus-flo
       sudo nano /etc/nginx/sites-available/opus-flo   # replace YOUR_DOMAIN
       sudo ln -s /etc/nginx/sites-available/opus-flo /etc/nginx/sites-enabled/
       sudo nginx -t && sudo systemctl reload nginx

  d. Issue a free SSL certificate:
       sudo certbot --nginx -d yourteam.yourdomain.com

  e. Close the direct port (traffic now flows through nginx on 443):
       sudo ufw delete allow 3847/tcp

  f. Enter  https://yourteam.yourdomain.com  in the Opus Flo app.

─────────────────────────────────────────────────────────────────────
LOCAL / SAME-NETWORK ONLY
Use when: everyone is on the same office or home network
─────────────────────────────────────────────────────────────────────

  1. Find this machine's local IP:
       Windows:    ipconfig  (look for IPv4 Address under your adapter)
       Mac/Linux:  ifconfig  or  ip addr
  2. Enter  http://192.168.x.x:3847  in the Opus Flo app on each device.
  3. Tip: assign a static local IP to this machine in your router's DHCP
     settings so the address does not change on lease renewal.
