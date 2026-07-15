/**
 * Arive Homes Base Plan Review Dashboard connector
 *
 * Setup:
 * 1) Open the Google Sheet.
 * 2) Extensions > Apps Script.
 * 3) Paste this file into Code.gs.
 * 4) Update SPREADSHEET_ID if needed.
 * 5) Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone with the link, or your organization
 * 6) Paste the Web App URL into config.js as WEB_APP_URL.
 */

const SPREADSHEET_ID = '1nZZrP-5gtEjAUbKmVSPSiYmQIRrUXaXQ6jucodH1gic';
const DASHBOARD_SHEET = 'Dashboard';

function doGet(e) {
  const action = (e.parameter.action || 'list').toLowerCase();
  const callback = e.parameter.callback;
  let output;

  if (action === 'list') {
    output = { ok: true, plans: getPlans_() };
  } else {
    output = { ok: false, error: 'Unknown action' };
  }

  const json = JSON.stringify(output);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const p = e.parameter || {};
  if ((p.action || '').toLowerCase() === 'update') {
    updatePlan_(p);
    appendMeetingLog_(p);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unknown action' })).setMimeType(ContentService.MimeType.JSON);
}

function getPlans_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(DASHBOARD_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 4) return [];
  const values = sh.getRange(4, 1, lastRow - 3, 8).getValues();
  return values
    .filter(r => r[0])
    .map((r, i) => ({
      id: slug_(r[0]),
      order: i + 1,
      name: r[0],
      reviewStatus: r[1] || 'Not Started',
      meetingDate: formatDate_(r[2]),
      changesDiscussed: r[3] || '',
      decision: r[4] || '',
      owner: r[5] || '',
      nextAction: r[6] || '',
      finalNotes: r[7] || '',
      agentNotes: sh.getRange(i + 4, 1).getNote() || ''
    }));
}

function updatePlan_(p) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(DASHBOARD_SHEET);
  const lastRow = sh.getLastRow();
  const names = sh.getRange(4, 1, Math.max(lastRow - 3, 1), 1).getValues().flat();
  const idx = names.findIndex(name => slug_(name) === p.id || name === p.name);
  if (idx === -1) throw new Error(`Floorplan not found: ${p.name}`);
  const row = idx + 4;
  sh.getRange(row, 2, 1, 7).setValues([[
    p.reviewStatus || 'Not Started',
    p.meetingDate || '',
    p.changesDiscussed || '',
    p.decision || '',
    p.owner || '',
    p.nextAction || '',
    p.finalNotes || ''
  ]]);
}

function appendMeetingLog_(p) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let log = ss.getSheetByName('Meeting Log');
  if (!log) {
    log = ss.insertSheet('Meeting Log');
    log.appendRow(['Timestamp','Floorplan','Review Status','Meeting Date','Changes Discussed','Decision / Direction','Owner','Next Action','Final Notes']);
  }
  log.appendRow([
    new Date(),
    p.name || '',
    p.reviewStatus || '',
    p.meetingDate || '',
    p.changesDiscussed || '',
    p.decision || '',
    p.owner || '',
    p.nextAction || '',
    p.finalNotes || ''
  ]);
}

function slug_(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function formatDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value);
}
