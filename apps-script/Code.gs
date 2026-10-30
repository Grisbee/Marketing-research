/**
 * @OnlyCurrentDoc
 * Receives survey responses from survey.html and stores them in this spreadsheet.
 * Setup steps are in README.md ("Collecting responses in Google Sheets").
 *
 * Requests are POSTed as JSON text:
 *   { action: "check",  email }                 -> { exists: true|false }
 *   { action: "submit", columns: [...], row: {} } -> { ok: true } | { ok: false, reason }
 *
 * The web app URL is public (it is in the page source), so everything a caller
 * sends is validated here before it touches the sheet.
 */
const SHEET_NAME = "Responses";
const COL_RE = /^[A-Za-z0-9_]{1,64}$/;   // every column the survey sends looks like this
const MAX_COLS = 250;                    // the survey uses ~110; stops anyone widening the sheet without limit
const MAX_LEN = 300;                     // longest text kept in one cell
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const sheet = getSheet_();
    if (req.action === "check") return json_({ exists: hasValue_(sheet, "email", normEmail_(req.email)) });
    if (req.action === "submit") return json_(submitLocked_(sheet, req.columns, req.row));
    return json_({ ok: false, reason: "unknown action" });
  } catch (err) {
    return json_({ ok: false, reason: String(err) });
  }
}

function submitLocked_(sheet, columns, row) {
  if (!Array.isArray(columns) || !columns.length || columns.length > MAX_COLS ||
      !columns.every(c => typeof c === "string" && COL_RE.test(c))) return { ok: false, reason: "bad columns" };
  if (!row || typeof row !== "object" || !row.resp_id || !EMAIL_RE.test(normEmail_(row.email))) return { ok: false, reason: "bad row" };
  const lock = LockService.getScriptLock();
  lock.waitLock(8000);   // shorter than the survey's 15 s request timeout, so a busy moment fails visibly instead of silently
  try {
    // The survey retries unsent answers, so the same response can arrive twice.
    if (hasValue_(sheet, "resp_id", String(row.resp_id))) return { ok: true };
    if (hasValue_(sheet, "email", normEmail_(row.email))) return { ok: false, reason: "duplicate" };
    const header = ensureHeader_(sheet, ["received_at"].concat(columns));
    const values = Object.assign({}, row, { email: normEmail_(row.email), received_at: new Date() });
    sheet.appendRow(header.map(col => col === "received_at" ? values.received_at : safeCell_(values[col])));
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
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
  if (header.length + missing.length > MAX_COLS + 1) throw new Error("too many columns");
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

// Only numbers and short strings are stored. Text starting with = + - @
// (e.g. a typed "Other" shop name) would otherwise run as a spreadsheet formula.
function safeCell_(v) {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v !== "string") return "";
  v = v.slice(0, MAX_LEN);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
