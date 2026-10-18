#!/bin/bash
# usage: shots.sh prefix  -> /workspace/shots/<prefix>-<page>-<w>.png
P=${1:-v2}; M=${MINT:-E5fPQtYvufDQ2V6hvzQ6FY8N9jYNzoQAc5npMeMJgQrZ}
cd /workspace/shots
for p in home: launch:launch explore:explore token:token/$M connect:connect claim:claim docs:docs mascot:mascot upload:upload/demo terms:terms privacy:privacy; do n=${p%%:*}; u=${p#*:}
 for w in 1280 390; do timeout 60 google-chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --virtual-time-budget=10000 --window-size=$w,$([ $n = launch ] && echo 900 || echo 2400) --screenshot=$P-$n-$w.png http://localhost:3100/$u >/dev/null 2>&1 & done; wait; done
ls $P-*
