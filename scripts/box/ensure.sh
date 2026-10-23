#!/usr/bin/env bash
# Idempotent: starts scripts/box/supervisor.sh detached if it is not running (the supervisor holds a flock).
# The box has no cron/systemd (PID 1 is tini), so this is called from ~/.bashrc (sourced by every agent shell
# and terminal after a box restart) — see scripts/box/install-autostart.sh.
DIR="${1:-/workspace/hcl-run}"
if flock -n /tmp/hcl-supervisor.lock true 2>/dev/null; then
  [ -x "$DIR/scripts/box/supervisor.sh" ] || chmod +x "$DIR/scripts/box/supervisor.sh" 2>/dev/null
  setsid nohup bash "$DIR/scripts/box/supervisor.sh" "$DIR" >>/tmp/hcl-supervisor.log 2>&1 < /dev/null &
  echo "$(date '+%F %T %Z') ensure: started supervisor" >>/tmp/hcl-supervisor.log
fi
