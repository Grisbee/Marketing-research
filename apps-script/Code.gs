/**
 * Receives survey responses from survey.html and stores them in this spreadsheet.
 * Setup steps are in README.md ("Collecting responses in Google Sheets").
 *
 * Requests are POSTed as JSON text:
 *   { action: "check",  email }                 -> { exists: true|false }
 *   { action: "submit", columns: [...], row: {} } -> { ok: true } | { ok: false, reason }
 */
const SHEET_NAME = "Responses";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);   // two people finishing at the same moment must not overwrite each other's row
  try {
    const req = JSON.parse(e.postData.contents);
    const sheet = getSheet_();
    if (req.action === "check") return json_({ exists: hasValue_(sheet, "email", normEmail_(req.email)) });
    if (req.action === "submit") return json_(submit_(sheet, req.columns || [], req.row || {}));
    return json_({ ok: false, reason: "unknown action" });
  } catch (err) {
    return json_({ ok: false, reason: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function submit_(sheet, columns, row) {
  // The survey retries unsent answers, so the same response can arrive twice.
  if (row.resp_id && hasValue_(sheet, "resp_id", String(row.resp_id))) return { ok: true };
  if (row.email && hasValue_(sheet, "email", normEmail_(row.email))) return { ok: false, reason: "duplicate" };
  const header = ensureHeader_(sheet, columns.length ? columns : Object.keys(row));
  sheet.appendRow(header.map(col => safeCell_(row[col])));
  return { ok: true };
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

// Header = first row. Columns the sheet does not have yet are added at the end,
// so a later version of the survey never shifts existing data.
function ensureHeader_(sheet, columns) {
  const header = sheet.getLastRow() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String) : [];
  const missing = columns.filter(c => !header.includes(c));
  if (missing.length) {
    sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
    sheet.setFrozenRows(1);
  }
  return header.concat(missing);
}

function hasValue_(sheet, column, value) {
  if (!value || sheet.getLastRow() < 2) return false;
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const idx = header.indexOf(column);
  if (idx < 0) return false;
  const values = sheet.getRange(2, idx + 1, sheet.getLastRow() - 1, 1).getValues();
  const norm = column === "email" ? normEmail_ : String;
  return values.some(([v]) => norm(v) === value);
}

const normEmail_ = v => String(v || "").trim().toLowerCase();

// Typed answers ("Other" shop name) starting with = + - @ would run as spreadsheet formulas.
function safeCell_(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "string" && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
