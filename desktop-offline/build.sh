#!/bin/sh
# Builds SWC-Selakui-Offline-Setup.exe on Linux (tested on Ubuntu).
# Needs: node, npm, unzip, curl, makensis (apt install nsis).
set -e
cd "$(dirname "$0")"
SRC="$PWD"
# The Google version's files; the screens and Code.gs come from there.
if [ -z "$WEB" ]; then
  for d in "$SRC/../web-app" "$SRC/../../handover/web-app"; do [ -f "$d/Code.gs" ] && WEB="$d" && break; done
fi
[ -f "$WEB/Code.gs" ] || { echo "Set WEB to the folder with Code.gs and the .html files"; exit 1; }
ELECTRON="${ELECTRON:-45.1.0}"
VERSION="$(node -p "require('./package.json').version")"
OUT="${OUT:-$SRC/..}"
B="$SRC/build"

rm -rf "$B"; mkdir -p "$B/payload"
[ -d "$SRC/tools/node_modules/resedit" ] || (mkdir -p "$SRC/tools" && cd "$SRC/tools" && npm init -y >/dev/null && npm i resedit@2 @electron/fuses@1)

if [ -n "$ELECTRON_ZIP" ]; then cp "$ELECTRON_ZIP" "$B/electron.zip"; else
  curl -fSL -o "$B/electron.zip" "https://github.com/electron/electron/releases/download/v$ELECTRON/electron-v$ELECTRON-win32-x64.zip"
fi
unzip -q "$B/electron.zip" -d "$B/payload"
rm "$B/payload/resources/default_app.asar" "$B/payload/dxcompiler.dll"   # dxcompiler is only for WebGPU; dropping it keeps the installer under 100 MB
find "$B/payload/locales" -type f ! -name 'en-US.pak' -delete
mv "$B/payload/electron.exe" "$B/payload/SWC Selakui.exe"
node build-ui.js "$WEB" "$B/payload/resources/app"
# The same app files, as a zip for Help > Install update on PCs that already have the app.
rm -f "$OUT/SWC-Update-$VERSION.zip"; (cd "$B/payload/resources/app" && zip -qr "$OUT/SWC-Update-$VERSION.zip" .)
NODE_PATH="$SRC/tools/node_modules" node patch-exe.js "$B/payload/SWC Selakui.exe" "$SRC/swc.ico" "$VERSION"

cp installer.nsi swc.ico "$B/"
(cd "$B" && makensis -V2 -DVERSION="$VERSION" -DOUTFILE="$OUT/SWC-Selakui-Offline-Setup.exe" installer.nsi)
echo "Built $OUT/SWC-Selakui-Offline-Setup.exe and $OUT/SWC-Update-$VERSION.zip"
