#!/usr/bin/env bash
# Adds a guarded hook at the top of ~/.bashrc so the supervisor comes back after a box restart.
DIR="${1:-/workspace/hcl-run}"; RC="$HOME/.bashrc"; TAG="# hcl-supervisor autostart"
grep -q "$TAG" "$RC" 2>/dev/null && { echo "already installed"; exit 0; }
tmp=$(mktemp); { echo "$TAG"; echo "[ -f $DIR/scripts/box/ensure.sh ] && ( bash $DIR/scripts/box/ensure.sh $DIR >/dev/null 2>&1 & )"; cat "$RC"; } >"$tmp" && cat "$tmp" >"$RC" && rm -f "$tmp"
echo "installed in $RC"
