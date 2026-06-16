#!/bin/sh
if [ ! -f .env ]; then
  echo "No .env file found. Copying .env.example to .env..."
  cp .env.example .env
  echo "Edit .env and set your JWT_SECRET, then re-run this script."
  exit 1
fi
node dist/index.js
