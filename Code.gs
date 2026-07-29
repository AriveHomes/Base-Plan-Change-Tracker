/***** ARIVE HOMES - BASE PLAN CHANGE TRACKER APPS SCRIPT *****/
const SPREADSHEET_ID = '1nZZrP-5gtEjAUbKmVSPSiYmQIRrUXaXQ6jucodH1gic';
const MASTER_SHEET = 'Floorplan Master';
const CHANGE_LOG_SHEET = 'Change Log';

const CHANGE_HEADERS = [
  'Change ID', 'Floorplan', 'Change Date', 'Change Type', 'Change Description',
  'Reason / Why', 'Requested By', 'Approved By', 'Status', 'Cost Impact',
  'Plan Set Updated?', 'Pricing Updated?', 'Option Updated?', 'Notes', 'Last Updated', 'Active'
];

function doGet(e) {
  e = e || { parameter: {} };
  const p = e.parameter || {};
  const action = String(p.action || 'list').toLowerCase();
  const callback = p.callback || '';
  let output;
  try {
    if (action === 'list' || action === 'load') {
      const plans = getPlans_();
      output = { ok: true, success: true, plans: plans, floorplans: plans, changes: getChanges_() };
    } else if (action === 'ping') {
      output = { ok: true, success: true, message: 'Apps Script is working', timestamp: new Date().toISOString() };
    } else {
      output = { ok: false, success: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    output = { ok: false, success: false, error: String(err && err.message ? err.message : err) };
  }
  return output_(output, callback);
}

function doPost(e) {
  e = e || { parameter: {}, postData: null };
  let payload = {};
  try {
    if (e.parameter && e.parameter.payload) payload = JSON.parse(e.parameter.payload);
    else if (e.postData && e.postData.contents) payload = JSON.parse(e.postData.contents);
    else payload = e.parameter || {};
  } catch (err) {
    payload = e.parameter || {};
  }
  const action = String(payload.action || e.parameter.action || '').toLowerCase();
  let output;
  try {
    if (action === 'savechange' || action === 'addchange' || action === 'updatechange' || action === 'upsertchange') {
      output = saveChange_(payload);
    } else if (action === 'archivechange' || action === 'deletechange') {
      output = archiveChange_(payload.changeId || payload.id);
    } else if (action === 'list' || action === 'load') {
      const plans = getPlans_();
      output = { ok: true, success: true, plans: plans, floorplans: plans, changes: getChanges_() };
    } else {
      output = { ok: false, success: false, error: 'Unknown post action: ' + action };
    }
  } catch (err) {
    output = { ok: false, success: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
}

function getPlans_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET);
  if (!sheet) throw new Error('Missing sheet tab: ' + MASTER_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 7).getDisplayValues();
  return values.filter(r => String(r[1] || '').trim()).map(r => ({
    id: slug_(r[1]),
    order: r[0] || '',
    name: r[1] || '',
    floorplan: r[1] || '',
    sales2025: r[2] || '',
    sales2024: r[3] || '',
    sales2023: r[4] || '',
    totalSales: r[5] || '',
    total: r[5] || '',
    agentNotes: r[6] || '',
    active: 'Yes'
  }));
}

function getChanges_() {
  const sheet = ensureChangeLogSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 16).getDisplayValues();
  return values.filter(r => String(r[0] || r[1] || '').trim()).map(r => ({
    id: r[0] || '',
    changeId: r[0] || '',
    floorplan: r[1] || '',
    plan: r[1] || '',
    changeDate: r[2] || '',
    date: r[2] || '',
    changeType: r[3] || '',
    type: r[3] || '',
    description: r[4] || '',
    changeDescription: r[4] || '',
    reason: r[5] || '',
    requestedBy: r[6] || '',
    approvedBy: r[7] || '',
    status: r[8] || '',
    costImpact: r[9] || '',
    planSetUpdated: r[10] || '',
    pricingUpdated: r[11] || '',
    optionUpdated: r[12] || '',
    notes: r[13] || '',
    lastUpdated: r[14] || '',
    active: r[15] || 'Yes'
  })).filter(c => String(c.active || 'Yes').toLowerCase() !== 'no');
}

function saveChange_(payload) {
  const sheet = ensureChangeLogSheet_();
  const floorplan = String(payload.floorplan || payload.plan || '').trim();
  if (!floorplan) throw new Error('Missing floorplan.');
  const id = String(payload.changeId || payload.id || generateChangeId_(floorplan)).trim();
  const now = new Date();
  const row = [
    id,
    floorplan,
    payload.changeDate || payload.date || Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    payload.changeType || payload.type || 'Other',
    payload.description || payload.changeDescription || '',
    payload.reason || '',
    payload.requestedBy || '',
    payload.approvedBy || '',
    payload.status || 'Proposed',
    payload.costImpact || '',
    payload.planSetUpdated || 'No',
    payload.pricingUpdated || 'No',
    payload.optionUpdated || 'No',
    payload.notes || '',
    now,
    'Yes'
  ];
  const existingRow = findChangeRow_(sheet, id);
  if (existingRow) sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return { ok: true, success: true, id: id, changeId: id, message: existingRow ? 'Updated change.' : 'Added change.' };
}

function archiveChange_(id) {
  if (!id) throw new Error('Missing change ID.');
  const sheet = ensureChangeLogSheet_();
  const row = findChangeRow_(sheet, id);
  if (!row) return { ok: false, success: false, error: 'Change not found: ' + id };
  sheet.getRange(row, 15).setValue(new Date());
  sheet.getRange(row, 16).setValue('No');
  return { ok: true, success: true, id: id, message: 'Archived change.' };
}

function ensureChangeLogSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CHANGE_LOG_SHEET);
  if (!sheet) sheet = ss.insertSheet(CHANGE_LOG_SHEET);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, CHANGE_HEADERS.length).setValues([CHANGE_HEADERS]);
  return sheet;
}

function findChangeRow_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) return i + 2;
  }
  return 0;
}

function generateChangeId_(floorplan) {
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const prefix = String(floorplan || 'PLAN').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'PLN';
  return 'CHG-' + date + '-' + prefix + '-' + Math.floor(Math.random() * 900 + 100);
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    const safeCallback = String(callback).match(/^[A-Za-z_$][A-Za-z0-9_$.]*$/) ? String(callback) : 'callback';
    return ContentService.createTextOutput(safeCallback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function slug_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
}
