# Arive Homes Base Plan Review Dashboard

**YOUR WEB APP URL HAS ALREADY BEEN ADDED TO `config.js`.**

Important: use the Apps Script code in `google-apps-script/Code.gs`. If you pasted an earlier code version into Apps Script, replace it with this file, then redeploy/manage deployment.

# Arive Homes Base Plan Review Dashboard

GitHub Pages dashboard for reviewing Arive Homes base floorplans and tracking weekly management meeting changes.

## Files
- `index.html` - dashboard page
- `styles.css` - Arive black/green styling
- `data.js` - built-in preview data
- `app.js` - dashboard behavior
- `config.js` - Google Sheet / Apps Script connection settings
- `google-apps-script/Code.gs` - optional connector for reading/writing Google Sheets

## Preview
Open `index.html` locally or publish the repo with GitHub Pages. The dashboard will show built-in preview data until you paste your deployed Google Apps Script Web App URL into `config.js`.

## Connect to Google Sheets
1. Open the Google Sheet.
2. Extensions > Apps Script.
3. Paste the contents of `google-apps-script/Code.gs`.
4. Deploy > New deployment > Web app.
5. Copy the Web App URL.
6. Paste it into `config.js` as `WEB_APP_URL`.

The Google Sheet already exists here:
https://docs.google.com/spreadsheets/d/1nZZrP-5gtEjAUbKmVSPSiYmQIRrUXaXQ6jucodH1gic/edit?usp=drivesdk
