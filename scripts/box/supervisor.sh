#!/usr/bin/env bash
# Keeps the worker and the Telegram bot running on the box and redeploys them when main gets a new commit.
# Usage: scripts/box/supervisor.sh [run-dir]   (start detached: setsid nohup scripts/box/supervisor.sh >/tmp/hcl-supervisor.log 2>&1 &)
# The run dir is a separate checkout so dev work in other clones is never reset. .env.local must exist there (never committed).
set -u
DIR="${1:-/workspace/hcl-run}"; REPO="${HCL_REPO:-https://github.com/AutoClawGPT/heyclawlaunch.git}"; BRANCH="${HCL_BRANCH:-main}"; EVERY="${HCL_POLL_SECS:-60}"
exec 9>/tmp/hcl-supervisor.lock; flock -n 9 || { echo "supervisor already running"; exit 0; }
log() { echo "$(date '+%F %T %Z') $*"; }
[ -d "$DIR/.git" ] || git clone -q --branch "$BRANCH" "$REPO" "$DIR"
cd "$DIR" || exit 1
[ -f .env.local ] || { log "missing $DIR/.env.local — copy it in (it is gitignored)"; exit 1; }
declare -A PID
start() { # $1 = worker|bot
  setsid pnpm "$1" >>"/tmp/hcl-$1.log" 2>&1 & PID[$1]=$!; log "started $1 pid ${PID[$1]} at $(git rev-parse --short HEAD)"; }
stop() { local p="${PID[$1]:-}"; [ -n "$p" ] || return 0; kill -TERM -- "-$p" 2>/dev/null; for _ in $(seq 20); do kill -0 "$p" 2>/dev/null || break; sleep 0.5; done; kill -KILL -- "-$p" 2>/dev/null; PID[$1]=""; }
deps() { if [ ! -d node_modules ] || [ pnpm-lock.yaml -nt node_modules/.modules.yaml ]; then log "installing deps"; pnpm install --frozen-lockfile >/tmp/hcl-install.log 2>&1 || log "pnpm install failed (see /tmp/hcl-install.log)"; fi; }
trap 'log "supervisor stopping"; stop worker; stop bot; exit 0' INT TERM
deps; start worker; start bot
while sleep "$EVERY"; do
  if git fetch -q "$REPO" "$BRANCH" 2>/dev/null && [ "$(git rev-parse FETCH_HEAD)" != "$(git rev-parse HEAD)" ]; then
    log "new commit $(git rev-parse --short FETCH_HEAD) — updating"
    git reset -q --hard FETCH_HEAD; deps
    stop worker; start worker; stop bot; start bot
  fi
  for s in worker bot; do p="${PID[$s]:-}"; if [ -z "$p" ] || ! kill -0 "$p" 2>/dev/null; then log "$s not running — restarting"; sleep 3; start "$s"; fi; done
done
