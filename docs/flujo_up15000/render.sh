#!/bin/sh
# Renderiza un SVG a PNG (x2.5) y opcionalmente PDF con Chromium headless.
# Uso: ./render.sh <ruta/sin/extension> <ancho> <alto> [pdf]
set -e
CH=${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}
N=$1; WD=$2; HT=$3
D=$(dirname "$N"); B=$(basename "$N")
cat > "$D/_p.html" <<HTML
<html><head><style>@page{size:${WD}px ${HT}px;margin:0}body{margin:0}img{display:block}</style></head><body><img src="$B.svg" width="$WD" height="$HT"></body></html>
HTML
$CH --headless --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=2.5 --window-size=$WD,$((HT+200)) --screenshot="$D/_big.png" "file://$PWD/$D/_p.html" >/dev/null 2>&1
convert "$D/_big.png" -crop $((WD*5/2))x$((HT*5/2))+0+0 +repage "$N.png"
if [ "$4" = "pdf" ]; then
  $CH --headless --no-sandbox --disable-gpu --no-pdf-header-footer --print-to-pdf="$N.pdf" "file://$PWD/$D/_p.html" >/dev/null 2>&1
fi
rm -f "$D/_p.html" "$D/_big.png"
