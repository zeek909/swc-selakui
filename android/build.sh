#!/bin/sh
# Builds SWC-Selakui.apk with the Debian/Ubuntu Android tools:
#   sudo apt-get install aapt zipalign apksigner dalvik-exchange android-sdk-platform-23 default-jdk
# Needs swc-release.keystore next to this script (keep it: updates must use the same key).
set -e
cd "$(dirname "$0")"
JAR=/usr/lib/android-sdk/platforms/android-23/android.jar
PASS="${SWC_KEY_PASS:-swcselakui}"
rm -rf build && mkdir -p build/gen build/classes
aapt package -f -m -J build/gen -M AndroidManifest.xml -S res -A assets -I "$JAR" -F build/unsigned.apk -0 arsc
javac -source 8 -target 8 -encoding UTF-8 -nowarn -bootclasspath "$JAR" -classpath "$JAR" -d build/classes $(find src build/gen -name '*.java')
dalvik-exchange --dex --min-sdk-version=21 --output=build/classes.dex build/classes
(cd build && aapt add unsigned.apk classes.dex >/dev/null)
zipalign -f -p 4 build/unsigned.apk build/aligned.apk
apksigner sign --ks swc-release.keystore --ks-pass "pass:$PASS" --min-sdk-version 21 --out SWC-Selakui.apk build/aligned.apk
apksigner verify --print-certs SWC-Selakui.apk | head -1
echo "Built SWC-Selakui.apk"
