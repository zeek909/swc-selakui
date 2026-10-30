# SWC Selakui, offline desktop app (source)

The whole SWC app as one Windows program. No internet, no Google account. Records stay on the PC in
`%APPDATA%\SWC Selakui\SWC data` (`data.json`, `photos\`, `backups\`).

It runs the **same** `Code.gs` and screens as the Google version. `gas-runtime.js` stands in for the
Google services that Code.gs uses (Sheets become tables in data.json, Drive becomes the photos folder,
sign-in sessions are kept in memory). So a fix made to the Google version's files is picked up here by
rebuilding.

| File | What it does |
| --- | --- |
| main.js | The window, the menus (Data: backup, restore, export; Help: reset admin PIN), first-start admin PIN and recovery code |
| gas-runtime.js | Runs Code.gs on the PC |
| preload.js | The one bridge from the screens to Code.gs |
| ui-src/desktop-shim.html | Makes `google.script.run` work offline; signs out after 20 idle minutes |
| build-ui.js | Joins Index.html, Styles.html and App.html into one page |
| patch-exe.js | Sets the program icon and name |
| installer.nsi | The Windows installer (per user, no admin rights) |
| build.sh | Builds `SWC-Selakui-Offline-Setup.exe` |

## Build (on Linux)

```
sudo apt install nsis unzip curl nodejs npm
./build.sh                      # uses ../web-app for Code.gs and the screens
```

Set `WEB=` to another folder with the five Google files, and `OUT=` for where the .exe goes.
Change the version in package.json before building an update. Built with Electron 45.1.0 (win32-x64).

## Backup file format

A `.swcbackup` file is JSON: `{ app: "SWC Selakui", kind: "backup", version: 1, createdAt, data, photos }`,
where `data` is data.json and `photos` maps each photo id to its base64 bytes.
