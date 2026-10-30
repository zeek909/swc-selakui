# SWC Selakui Android app (source)

A small Android app that opens the committee's Google Apps Script web app in a WebView. On first launch it asks for the committee's app link (the `.../exec` Web app URL) and remembers it; Back on the first screen offers "Change link". Camera and gallery uploads work through the page's photo buttons.

- Package: `org.swcselakui.app`, min Android 5 (API 21), target API 34.
- `src/` Java sources, `assets/setup.html` the link screen, `res/` icons and theme.
- `swc-release.keystore` signs the APK (alias `swc`, password `swcselakui`). **Keep it.** Any update must be signed with this same file, or phones will refuse to install it over the old app.

## Build

On Ubuntu or Debian:

    sudo apt-get install default-jdk aapt zipalign apksigner dalvik-exchange android-sdk-platform-23
    ./build.sh

Before building an update, raise `android:versionCode` (and `versionName`) in `AndroidManifest.xml`.
