# SWC Selakui app: setup and handover guide

This guide is for the Staff Welfare Committee member who sets up the SWC app, and for each new committee that takes it over. You don't need any technical knowledge. Follow the steps in order.

**What the app does:** staff report visitors staying in the staff quarters, report quarrels or disputes (with or without their name), and the committee keeps track of party and meal donations and expenses with bill photos.

**How it works:** the app runs free on Google. All records are kept in one Google Sheet, and photos are kept in a private Google Drive folder, both inside a Google account that belongs to the committee. Staff don't need Google accounts. They sign in with a staff ID and a PIN that the committee gives them.

**Two versions: choose one before you start.**

| | Google version (Parts A to D) | Offline PC version (Part E) |
| --- | --- | --- |
| Where records are kept | A committee Google account | One Windows PC only |
| Needs internet | Yes | No |
| Needs a Google account | Yes, one for the committee | No |
| Staff report from their own phone or tablet | Yes | No: they come to the PC, or tell a committee member who enters it |
| Backups | Google keeps the records safe | Automatic copies on the PC, plus a USB copy you make each week |
| Setup time | About 45 minutes | About 5 minutes |

The two versions keep separate records and can't share them, so the committee should pick one. If you choose the offline PC version, skip straight to **Part E**.

**Three ways to use the Google version.** All three open the same records, so people can use whichever suits them, or more than one:

- **In a web browser** (Chrome) on any PC, tablet, Android phone or iPhone. Nothing to install.
- **As an Android app** (SWC-Selakui.apk), shared on WhatsApp.
- **As a desktop app** on a Windows PC or laptop (or a Mac), with its own icon and window. Good for the committee's office computer.

## What's in this package

| File | What it is |
| --- | --- |
| SWC-Selakui-Setup-Guide.pdf | This guide |
| SWC-Selakui-Offline-Setup.exe | The offline PC version: installs the whole app on one Windows PC (Part E) |
| SWC-Selakui.apk | The Android app, to share with staff |
| desktop-app folder | Installs the SWC app on a Windows PC or laptop |
| web-app folder | The five app files you paste into Google in Step 3 |
| android-source folder | Only needed if someone wants to change the Android app later. Keep it safe, but you can ignore it |
| desktop-offline-source folder | Only needed if someone wants to change the offline PC version later. You can ignore it |

## Before you start (Google version)

- Use a **PC or laptop with Google Chrome**. Setup on a phone is very hard.
- Set aside about **45 minutes**.
- Have a **phone nearby** that can receive an SMS code from Google (the committee secretary's phone is a good choice).
- Unzip the package on the computer so you can see the **web-app** folder.

# Part A: Set up the app (once)

## Step 1. Create the committee's Google account

The records must live in a Google account that belongs to the committee, **never in anyone's personal Gmail**. The committee changes every year; the account is handed over with it, so the records stay with the committee.

1. In Chrome, open a **new Incognito window** (press **Ctrl + Shift + N**). This keeps your own Google account out of the way. Do all of Steps 1 to 5 in this one window.
2. Go to **gmail.com** and click **Create account**.
3. Choose **For my personal use**.
   - Do **not** choose "For my child": that makes a child account with limits, and the app won't work.
   - If you see a page that says "404" or "not found", go back to gmail.com and start again from **Create account**.
4. **Name:** first name **SWC**, last name **Selakui**.
5. **Birthday:** enter an adult's date of birth (for example the secretary's). It must be over 18, or Google creates a restricted account. **Gender:** "Rather not say" is fine.
6. **Gmail address:** choose **Create your own Gmail address** and type something like **swc.selakui**. If it is taken, try **swc.tcvselakui** or add the year, such as **swcselakui2026**.
7. **Password:** make a strong one (at least 12 characters). Write it on the **Account record** page at the end of this guide, not in WhatsApp.
8. **Phone number:** enter the secretary's mobile and type the code Google sends by SMS. **Recovery email:** the secretary's own email. (These are changed at each handover.)
9. Skip any offers (Google Pay, personalisation) and agree to the terms.

You are now signed in as the committee account. Fill in the **Account record** page now.

## Step 2. Create the records sheet

1. In the same Incognito window, go to **sheets.new**. A new, empty Google Sheet opens.
2. Click **Untitled spreadsheet** at the top left and rename it **SWC Records**.

## Step 3. Paste the app into the sheet

1. In the sheet, click **Extensions > Apps Script**. A code editor opens in a new tab.
2. Click **Untitled project** at the top and rename it **SWC app**.
3. Click the **gear icon** on the left (**Project Settings**) and tick **Show "appsscript.json" manifest file in editor**. Then click the **< >** icon (**Editor**) to go back.
4. You will see **Code.gs** and **appsscript.json** on the left. For each one:
   1. Click it, select everything in the editor (**Ctrl + A**) and delete it.
   2. On the computer, open the file with the same name from the **web-app** folder. Right-click it, choose **Open with > Notepad**, then **Ctrl + A** and **Ctrl + C** to copy it.
   3. Paste it into the editor (**Ctrl + V**).
5. Now add three more files. Click the **+** next to **Files** and choose **HTML**. Type the name exactly as shown, without ".html" (the editor adds it), and press Enter:
   - **Index**, then paste in **Index.html**
   - **Styles**, then paste in **Styles.html**
   - **App**, then paste in **App.html**
6. Click the **Save** icon (the floppy disk). Check that the left side now shows exactly: appsscript.json, Code.gs, Index.html, Styles.html, App.html.

## Step 4. Run setup once

1. At the top of the editor there is a drop-down list of functions. Choose **setup** and click **Run**.
2. A box says "Authorisation required". Click **Review permissions** and choose the committee account.
3. Google shows **"Google hasn't verified this app"**. This is normal: the app belongs to the committee, not to a company. Click **Advanced**, then **Go to SWC app (unsafe)**, then **Allow**. The app only gets access to this sheet and the photo folder it creates.
4. The **Execution log** opens at the bottom. Find the line **Admin created. Staff ID: admin   Temporary PIN: 123456**. Write the PIN on the Account record page.

The sheet now has tabs for Staff, Visitors, Disputes, Events, Donations, Expenses and Settings. Google Drive now has a folder called **SWC bills and photos (private)**. Don't rename or edit these by hand.

## Step 5. Publish the app

1. In the editor, click the blue **Deploy** button, then **New deployment**.
2. Click the **gear** next to "Select type" and choose **Web app**.
3. Fill in:
   - Description: **SWC app**
   - Execute as: **Me (the committee email)**
   - Who has access: **Anyone** ("Anyone" only means the page can be opened; nobody sees any records without a staff ID and PIN.)
4. Click **Deploy**. Copy the **Web app URL**. It starts with **https://script.google.com/macros/s/** and ends with **/exec**.
5. Write the link on the Account record page (or save it in the committee account's Google Keep). **This link is the app.** Everyone uses the same link.
6. Open the link in Chrome to check it works. You should see the maroon "Staff Welfare Committee" header and a sign-in box.

## Step 6. Sign in and add the staff

1. Open the app link. Sign in with staff ID **admin** and the temporary PIN from Step 4. Choose a new PIN of your own.
2. Open **Staff and settings**.
3. Add each staff member: a short staff ID that is easy to remember (for example **tenzin.d** or **pema.y**), their full name and their quarter number.
4. Each time you add someone, the app shows a **4-digit PIN once**. Write it down to give to that person. They choose their own PIN the first time they sign in. If someone forgets their PIN, press **New PIN** next to their name.
5. Give the committee members the role **Committee member**. Give one or two people the role **Admin** (the admin can add staff and change settings).
6. Under **Settings**, check how many nights count as a "long stay" and edit the expense categories if needed.

## Step 7. Share the app with staff

Send this message in the staff WhatsApp group, with the app link and the **SWC-Selakui.apk** file:

> **SWC app for staff quarters**
>
> Please use this to report visitors staying in your quarter, and to report any dispute to the committee (you can stay anonymous).
>
> **Android phone or tablet:** install the attached SWC-Selakui app. When it asks for a link, paste this one: [app link]
>
> **iPhone, PC, or if you prefer the browser:** open this link in Chrome: [app link]
>
> **Committee PC or laptop:** ask the SWC secretary to install the desktop app.
>
> Sign in with the staff ID and PIN the committee gives you. Ask any SWC member for help.

Then give each person their staff ID and first PIN privately (in person or by direct message).

Setup is done. Close the Incognito window.

# Part B: For staff

## Using it in the browser (any device)

1. Tap the app link and it opens in Chrome.
2. To keep it like an app: tap Chrome's **⋮** menu, then **Add to Home screen** (on iPhone in Safari: the **Share** button, then **Add to Home Screen**).
3. Sign in with your staff ID and PIN.

## Installing the Android app

The app isn't on the Play Store, so Android asks for permission the first time. This is normal for apps shared by WhatsApp.

1. In WhatsApp, tap **SWC-Selakui.apk** to download it, then tap it again to open it.
2. If Android says **"For your security, your phone is not allowed to install unknown apps from this source"**, tap **Settings**, turn on **Allow from this source**, and press Back.
3. Tap **Install**.
4. If **Google Play Protect** shows a warning, tap **More details** and then **Install anyway** (on some phones: **Install without scanning**). Play Protect warns about every app that doesn't come from the Play Store.
5. Open **SWC Selakui** from the home screen. The first time, it asks for the **committee app link**. Copy the link from WhatsApp (press and hold it, then **Copy**), paste it in the box, and tap **Open the app**.
6. Sign in with your staff ID and PIN.

The Android app works on Android 5 and newer. It can take photos of bills and IDs with the camera or pick them from the gallery. To change the link later, press **Back** on the app's first screen and choose **Change link**.

**Printing:** the "Print summary" button for party funds works from Chrome on a PC, not from the Android app.

## Using it as a desktop app (PC or laptop, needs internet)

This gives the app its own icon on the desktop and its own window, without browser tabs or an address bar. It is a good choice for the committee's office computer. Pick one of these two ways.

**Way 1: the installer in this package (Windows 10 or 11)**

1. Copy the **desktop-app** folder from this package onto the computer (for example onto the Desktop). Keep all four files together.
2. Double-click **Install SWC desktop app**.
3. If Windows shows **"Windows protected your PC"**, click **More info**, then **Run anyway**. Windows shows this for any small program that doesn't come from a big company.
4. A box asks for the **committee app link**. Paste it (**Ctrl + V**) and click **OK**.
5. The app opens in its own window, and **SWC Selakui** now appears on the Desktop and in the Start menu. To keep it in the taskbar, right-click its icon in the taskbar and choose **Pin to taskbar**.

It uses Microsoft Edge (already on every Windows 10 and 11 computer) or Google Chrome, but opens as a separate app. To remove it, double-click **Remove SWC desktop app**. Removing it never touches the records.

**Way 2: from the browser (Windows, Mac or Linux)**

- **Google Chrome:** open the app link, click the **⋮** menu (top right), then **Cast, save and share > Install page as app**, and click **Install**. In older versions of Chrome, the menu says **Create shortcut**: tick **Open as window** and click **Create**.
- **Microsoft Edge:** open the app link, click the **⋯** menu, then **Apps > Install this site as an app**, and click **Install**.

The app then appears in the Start menu (Windows) or the Applications folder and Launchpad (Mac), and opens in its own window. **Print summary** works in the desktop app.

## Who can see what

| | Staff | Committee | Admin |
| --- | --- | --- | --- |
| Report a visitor, change their own visitor dates, mark the visitor as left | Yes | Yes | Yes |
| Report a dispute (with or without their name) | Yes | Yes | Yes |
| See their own reports and the status of their disputes | Yes | Yes | Yes |
| Dashboard, all visitor reports, approve or decline | | Yes | Yes |
| Read dispute cases, set meetings, add notes | | Yes | Yes |
| Party funds: events, donations, expenses, bills, print summary | | Yes | Yes |
| Add staff, reset PINs, change settings | | | Yes |

Anonymous dispute reports never record who sent them, so even the committee cannot see the sender.

# Part C: Yearly handover (when the committee changes)

Do this at the start of each school year, or whenever committee members change. It takes about 20 minutes. **The app link stays the same, and staff don't need to do anything.**

**1. Hand over the Google account (outgoing and new secretary together)**

1. Sign in to the committee Gmail and go to **myaccount.google.com**.
2. **Security > Password:** change the password. Write the new one on the Account record page.
3. **Security > Recovery phone** and **Recovery email:** change them to the new secretary's.
4. **Security > Your devices:** sign out any device that no longer belongs to the committee.
5. Hand the Account record page over in person. Two committee members should know the password, so the records never depend on one person.

**2. Update people in the app (admin)**

1. Sign in as admin and open **Staff and settings**.
2. **New staff:** add them and give them the PIN the app shows.
3. **Staff who left:** set **Active** to **No** and press **Save**. Don't delete them: their old reports and donations stay in the records, but they can no longer sign in.
4. **Moved quarters:** change the quarter number and press **Save**.
5. **New committee:** set new members to **Committee member**, set outgoing members back to **Staff** (or Active **No** if they left).
6. **New admin:** give them the **Admin** role and press **New PIN** for them, so the outgoing admin's PIN can't be used. Always keep at least one admin.

**3. Close the year's money**

1. Under **Party funds**, open each finished event, press **Close event**, then **Print summary** (from a PC) for the staff meeting.
2. In the Google Sheet, use **File > Make a copy** and name it with the year (for example **SWC Records 2026-27 archive**) as a backup.

# Part D: Problems and answers

**Someone forgot their PIN.** The admin presses **New PIN** next to their name in Staff and settings.

**The admin forgot their PIN.** Sign in to the committee Google account, open the SWC Records sheet, then **Extensions > Apps Script**. Choose the function **resetAdminPin** and click **Run**. The Execution log shows a new temporary PIN for staff ID **admin**. Sign in as admin with it, and from there you can give any other admin a New PIN.

**"Too many wrong PINs".** Wait 15 minutes and try again.

**"Sorry, unable to open the file at this time".** This happens when someone opens the editor or sheet while signed in to several Google accounts. Use an Incognito window with only the committee account.

**The Android app says "Can't reach the app".** The phone has no internet. Turn on Wi-Fi or mobile data and tap **Try again**.

**A small grey line says "This application was created by a Google Apps Script user".** This is normal for free Google web apps.

**Changing the app later.** If someone changes any file in the editor, click **Deploy > Manage deployments**, press the **pencil** icon, set **Version: New version** and click **Deploy**. The link stays the same. Don't make a "New deployment" again, because that creates a new link and everyone would have to change theirs.

**Backups.** The records are an ordinary Google Sheet. Use **File > Make a copy** now and then, or **File > Download > Microsoft Excel**. Don't edit the first row (the column names) or delete tabs. Changes should go through the app so totals stay right.

**Is the data private?** Yes. The sheet and the photo folder are private to the committee Google account. Staff see only their own reports. Never share the sheet or folder with personal accounts.

**Photos** are made smaller on the device before upload (about 200 to 400 KB each), so they upload quickly on school Wi-Fi. Sign-in lasts 6 hours.

**The committee link changed (a new copy of the app was set up).** Android app: press Back on the first screen and choose **Change link**. Windows desktop app: run **Install SWC desktop app** again and paste the new link. Browser and Way 2 desktop apps: open the new link and install it again.

**Updating the Android app.** The android-source folder has instructions for a technical person. A new version must be signed with the same key file (swc-release.keystore) in that folder, or phones will refuse it as an update. Keep a copy of that folder in the committee's Google Drive.

# Part E: The offline PC version (no internet, no Google)

This version is the whole app inside one Windows program. It needs no internet and no Google account. Everything (staff list, visitor reports, disputes, donations, expenses and bill photos) is kept on that one PC. The screens are the same as the Google version.

**Good to know before choosing it:** staff can't send reports from their own phones. Reports are made at this PC, by the staff member or by a committee member on their behalf. And if the PC is lost, stolen or broken, the records go with it unless you keep a USB backup (see **Backups** below).

## E1. Install it (about 5 minutes)

You need a PC or laptop with **Windows 10 or 11 (64-bit)**. Use the committee's own computer and a Windows login that only committee members know.

1. Copy **SWC-Selakui-Offline-Setup.exe** onto the PC and double-click it. If you have **SWC-Selakui-Offline-Setup.zip** instead, right-click it, choose **Extract All**, then double-click the .exe inside.
2. If Windows shows **"Windows protected your PC"**, click **More info**, then **Run anyway**. Windows shows this for any program that doesn't come from a big company.
3. Click **Next**, wait a moment, then click **Finish**. No administrator password is needed.

**SWC Selakui** now has an icon on the Desktop and in the Start menu. To keep it in the taskbar, right-click its icon in the taskbar and choose **Pin to taskbar**.

## E2. First start

The first time it opens, a box shows three things: the staff ID **admin**, a **temporary PIN**, and a **recovery code** (for example **K7QM-4XPT**).

1. Write all three on the **Account record** page at the end of this guide, or click **Save to a text file**, print it, then delete the file from the PC.
2. Keep the **recovery code** somewhere safe, away from the PC. It is the only way to reset the admin PIN if it is forgotten.
3. Sign in as **admin** with the temporary PIN. The app asks you to choose your own PIN.
4. Open **Staff and settings** and add the staff and committee members, the same as **Step 6** of Part A. Give each person the PIN the app shows.

## E3. Everyday use

- Each person signs in with their own staff ID and PIN, and presses **Sign out** (top right) when finished. If nobody touches the PC for 20 minutes, the app signs out by itself.
- **Print summary** for party funds works, and so does **File > Print**.
- Bill and ID photos: click **Take photo or upload** and choose a photo saved on the PC (for example, copied from a phone with a USB cable or WhatsApp Desktop).
- The **View** menu makes the text bigger or smaller (**Ctrl +** and **Ctrl −**).

## E4. Backups (please do this every week)

- **Automatic:** each day the app is opened, it saves a copy of all records on the PC and keeps the last 14 days. These copies don't help if the PC itself breaks.
- **USB copy, every week:** sign in as admin, then choose **Data > Back up now…** from the menu at the top of the window. Save the file on a USB drive kept by the secretary. The file holds everything, photos included, so keep it private: it has dispute reports in it.
- **Restore:** sign in as admin, choose **Data > Restore from a backup…** and pick a backup file. Anything entered after that backup is replaced. The app saves a copy of the current records first, just in case.
- **For Excel:** **Data > Export for Excel (CSV)…** makes a folder with one file per list (visitors, disputes, donations, expenses, expense items, staff without PINs) and the photos. Open the files in Excel.

Only the admin can make backups, restore or export.

## E5. Moving to a new PC

1. On the old PC, make a USB backup (**Data > Back up now…**).
2. Install the app on the new PC (E1). It shows a new temporary admin PIN: sign in with it.
3. Choose **Data > Restore from a backup…** and pick the USB backup. Everything comes back, and the admin PIN and recovery code are the ones from the old PC again.
4. Uninstall the app from the old PC if it is leaving the committee.

## E6. Yearly handover (offline PC version)

1. Hand over in person: the **Windows login** for the PC, the **admin PIN**, the **recovery code**, and the **USB backup drive**.
2. Update the people in the app exactly as in **Part C, step 2**.
3. For the year's money, close each finished event and press **Print summary**, as in **Part C, step 3**. Instead of copying a Google Sheet, make a USB backup and name it with the year (for example **SWC backup 2026-27.swcbackup**).

## E7. Problems and answers (offline PC version)

**The admin forgot their PIN.** Choose **Help > Reset admin PIN…** and type the recovery code. The app shows a new temporary admin PIN **and a new recovery code**. Write the new code down, because the old one stops working.

**Someone else forgot their PIN.** The admin presses **New PIN** next to their name in Staff and settings, as in the Google version.

**Where are the records on the PC?** In the folder **%APPDATA%\SWC Selakui\SWC data** (Help > Where is the data kept? shows it). Don't edit or move these files by hand.

**Removing the app.** Windows **Settings > Apps**, find **SWC Selakui (offline)** and click **Uninstall**. The records are kept on the PC, so installing again brings everything back. To remove the records too, delete the **SWC Selakui** folder in %APPDATA% afterwards, but make a USB backup first.

**Installing a newer version.** Run the new **SWC-Selakui-Offline-Setup.exe**. It replaces the program and keeps all records.

**Mac or Linux.** The offline version is made for Windows. On a Mac, use the Google version in Chrome instead.

# Account record (fill in by hand, keep in the SWC file)

| | |
| --- | --- |
| Committee Gmail address | |
| Password (changed each handover) | |
| Recovery phone (current secretary) | |
| App link (Web app URL) | |
| Sheet name | SWC Records |
| **Offline PC version only:** which PC | |
| Admin recovery code (keep away from the PC) | |
| Where the USB backup drive is kept | |
| Set up by / date | |
| Handed over to / date | |
| Handed over to / date | |
| Handed over to / date | |
