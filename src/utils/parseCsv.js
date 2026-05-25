import Papa from 'papaparse';

// ── Column alias tables ────────────────────────────────────────────────────

const ZIP_ALIASES = new Set([
  'Ship Zipcode', 'Ship Zip', 'Shipping Zip Code', 'Shipping Zip',
  'Zip', 'ZIP', 'Zip Code', 'ZipCode', 'zip_code',
  'Postal Code', 'PostalCode', 'postal_code',
  'Billing Zip', 'shipping_postcode', 'billing_postcode',
]);

const COUNT_ALIASES = new Set([
  'Quantity', 'Qty', 'Count', 'Orders', 'Sales', 'Items', 'Units',
  'Number of Items', 'Item Count',
]);

const DATE_ALIASES = new Set([
  'Sale Date', 'Order Date', 'Date', 'Created At', 'Transaction Date',
  'Sold Date', 'Purchase Date', 'sale_date', 'order_date', 'created_at',
]);

const ZIP_REGEX   = /\bzip\b|postal.?code/i;
const COUNT_REGEX = /\bcount\b|\bqty\b|quantity|\bsales\b|\borders\b/i;
const DATE_REGEX  = /\bdate\b|created.?at/i;

// ── Date normalization ─────────────────────────────────────────────────────

const MONTH_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse a date string in various formats into a YYYY-MM-DD string.
 * Returns null if the value cannot be parsed.
 * Handles: YYYY-MM-DD · MM/DD/YYYY · MMM-DD-YYYY · MMM DD, YYYY
 */
export function parseIsoDate(str) {
  if (!str) return null;
  str = String(str).trim();

  // YYYY-MM-DD (already ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // MM/DD/YYYY
  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }

  // MMM-DD-YYYY  or  MMM DD, YYYY  (e.g. Jan-15-2024, Jan 15, 2024)
  const named = str.match(/^([A-Za-z]{3})[-\s](\d{1,2})[,\s-]+(\d{4})$/);
  if (named) {
    const m = MONTH_MAP[named[1].toLowerCase()];
    if (m) return `${named[3]}-${String(m).padStart(2, '0')}-${named[2].padStart(2, '0')}`;
  }

  return null;
}

// ── Column detection ───────────────────────────────────────────────────────

function detectColumns(headers) {
  let zipIdx = -1, countIdx = -1, dateIdx = -1;
  let confidence = 'low';

  // Pass 1: exact alias matches
  for (let i = 0; i < headers.length; i++) {
    if (zipIdx   === -1 && ZIP_ALIASES.has(headers[i]))   { zipIdx   = i; confidence = 'high'; }
    if (countIdx === -1 && COUNT_ALIASES.has(headers[i])) countIdx = i;
    if (dateIdx  === -1 && DATE_ALIASES.has(headers[i]))  dateIdx  = i;
  }

  // Pass 2: regex fallback
  if (zipIdx === -1)
    zipIdx = headers.findIndex(h => ZIP_REGEX.test(h));
  if (countIdx === -1) {
    const idx = headers.findIndex(h => h !== headers[zipIdx] && COUNT_REGEX.test(h));
    if (idx !== -1) countIdx = idx;
  }
  if (dateIdx === -1)
    dateIdx = headers.findIndex(h => h !== headers[zipIdx] && h !== headers[countIdx] && DATE_REGEX.test(h));

  if (zipIdx === -1) zipIdx = 0;
  if (countIdx === zipIdx) countIdx = -1;
  if (dateIdx === zipIdx || dateIdx === countIdx) dateIdx = -1;

  return { zipIdx, countIdx, dateIdx, confidence };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse a CSV File and return raw data + auto-detected column mapping.
 * @returns {{ headers, rows, zipIdx, countIdx, dateIdx, confidence }}
 */
export function sniffCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: ({ data }) => {
        if (!data.length) {
          return resolve({ headers: null, rows: [], zipIdx: 0, countIdx: -1, dateIdx: -1, confidence: 'low' });
        }

        const firstRow = data[0].map(v => String(v).trim());
        const isHeader = firstRow.every(v => !/^\d{3,5}$/.test(v));
        const headers  = isHeader ? firstRow : null;
        const rows     = data.slice(isHeader ? 1 : 0);
        const numCols  = firstRow.length;

        let zipIdx = 0, countIdx = numCols >= 2 ? 1 : -1, dateIdx = -1, confidence = 'low';

        if (headers) {
          ({ zipIdx, countIdx, dateIdx, confidence } = detectColumns(headers));
        }

        resolve({ headers, rows, zipIdx, countIdx, dateIdx, confidence });
      },
      error: reject,
    });
  });
}

/**
 * Aggregate raw rows into [{zip, count}], with optional date range filtering.
 * @param {string[][]} rows
 * @param {number} zipIdx
 * @param {number} countIdx   -1 = count every row as 1
 * @param {number} dateIdx    -1 = no date filtering
 * @param {string|null} fromDate  YYYY-MM-DD inclusive lower bound
 * @param {string|null} toDate    YYYY-MM-DD inclusive upper bound
 */
export function aggregateRows(rows, zipIdx, countIdx, dateIdx = -1, fromDate = null, toDate = null) {
  const filterDates = dateIdx >= 0 && (fromDate || toDate);
  const agg = new Map();

  for (const row of rows) {
    if (filterDates) {
      const d = parseIsoDate(row[dateIdx]);
      if (d) {
        if (fromDate && d < fromDate) continue;
        if (toDate   && d > toDate)   continue;
      }
    }
    const zip = normalizeZip(row[zipIdx]);
    if (!zip) continue;
    const raw   = countIdx >= 0 ? parseFloat(row[countIdx]) : NaN;
    const count = isNaN(raw) || raw <= 0 ? 1 : raw;
    agg.set(zip, (agg.get(zip) ?? 0) + count);
  }

  return [...agg.entries()].map(([zip, count]) => ({ zip, count }));
}

// ── Internal ───────────────────────────────────────────────────────────────

function normalizeZip(val) {
  if (val == null) return null;
  const s = String(val).trim().replace(/\.0+$/, '');
  if (!s || s.length < 3 || s.length > 5) return null;
  return s.padStart(5, '0');
}
