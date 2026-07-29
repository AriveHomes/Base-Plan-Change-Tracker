# Arive Homes Base Plan Change Tracker

## Upload to GitHub
Upload these files to the root of your GitHub repository:

- index.html
- styles.css
- app.js
- config.js
- debug.html
- README.md
- google-apps-script/Code.gs

## Apps Script
1. Open the Google Sheet.
2. Extensions > Apps Script.
3. Replace the current code with google-apps-script/Code.gs from this package.
4. Save.
5. Deploy > Manage deployments > pencil icon > New version > Deploy.
6. Copy the Web app URL ending in /exec.

## config.js
Paste that same working /exec URL into all three fields:

- APPS_SCRIPT_URL
- GOOGLE_SCRIPT_URL
- WEB_APP_URL

## Test
Open debug.html on your GitHub Pages site. Click Run live data test.
It should say Brendan found: YES.
