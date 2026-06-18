# Opus Flo Server

## Requirements (Windows)
  None â€” Node.js v22 is bundled. Just extract and run start.bat.

## Requirements (Mac / Linux)
  Node.js 24 LTS  (https://nodejs.org)

## Setup (first time only)
  1. Copy .env.example to .env
  2. Open .env in a text editor and set JWT_SECRET to a long random string
  3. Run start.bat (Windows) or  sh start.sh (Mac/Linux)

## Running
  Windows:    double-click start.bat
  Mac/Linux:  sh start.sh
  Default port: 3847  (change PORT= in .env)

## Finding your IP address
  Windows:    run  ipconfig  in Command Prompt â†’ look for IPv4 Address
  Mac/Linux:  run  ifconfig  or  ip addr
  Enter that IP in the Opus Flo desktop app: http://192.168.x.x:3847

## Auto-start on Windows login
  1. Right-click start.bat > Create shortcut
  2. Press Win+R, type shell:startup, press Enter
  3. Move the shortcut into that folder
