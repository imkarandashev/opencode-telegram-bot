#!/usr/bin/env bash
set -e

# Supervisor starts non-login shells, so initialize Node.js explicitly.
. /opt/nvm/nvm.sh
cd /root/opencode-telegram-bot
exec npm start
