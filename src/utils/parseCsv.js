import Papa from 'papaparse';

// Exact header names from known export formats — checked before regex fallback
const ZIP_ALIASES = new Set([
  // Etsy
  'Ship Zipcode', 'Ship Zip', 'Shipping Zip Code', 'Shipping Zip',
  // Generic
  'Zip', 'ZIP', 'Zip Code', 'ZipCode', 'zip_code',
  'Postal Code', 'PostalCode', 'postal_code',
  // Shopify
  'Shipping Zip', 'Billing Zip',
  // WooCommerce
  'shipping_postcode', 'billing_postcode',
]);

const COUNT_ALIASES = new Set([
  'Quantity', 'Qty', 'Count', 'Orders', 'Sales', 'Items', 'Units',
  'Number of Items', 'Item Count',
]);

// Regex fallback — narrow enough to avoid "Coupon Code", "Promo Code" etc.
const ZIP_REGEX = /\bzip\b|postal.?code/i;
const COUNT_REGEX = /\bcount\b|\bqty\b|quantity|\bsales\b|\borders\b/i;

function normalizeZip(val) {
  if (val == null) return null;
  const s = String(val).trim().replace(/\.0+$/, '');
  if (!s || s.length < 3 || s.length > 5) return null;
  return s.padStart(5, '0');
}

function detectColumns(headers) {
  let zipIdx = -1;
  let countIdx = -1;
  let confidence = 'low';

  // Pass 1: exact alias match (priority)
  for (let i = 0; i < headers.length; i++) {
    if (zipIdx === -1 && ZIP_ALIASES.has(headers[i])) { zipIdx = i; confidence = 'high'; }
    if (countIdx === -1 && COUNT_ALIASES.has(headers[i])) countIdx = i;
  }

  // Pass 2: regex fallback
  if (zipIdx === -1) zipIdx = headers.findIndex(h => ZIP_REGEX.test(h));
  if (countIdx === -1) {
    const idx = headers.findIndex(h => h !== headers[zipIdx] && COUNT_REGEX.test(h));
    if (idx !== -1) countIdx = idx;
  }

  // Last resort: assume first column is zip
  if (zipIdx === -1) zipIdx = 0;
  if (countIdx === zipIdx) countIdx = -1;

  return { zipIdx, countIdx, confidence };
}

/**
 * Parse a CSV File and return raw data + auto-detected column mapping.
 * @returns {{ headers: string[]|null, rows: string[][], zipIdx: number, countIdx: number, confidence: 'high'|'low' }}
 */
export function sniffCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: ({ data }) => {
        if (!data.length) return resolve({ headers: null, rows: [], zipIdx: 0, countIdx: -1, confidence: 'low' });

        const firstRow = data[0].map(v => String(v).trim());

        // Header row: no cell looks like a bare zip code
        const isHeader = firstRow.every(v => !/^\d{3,5}$/.test(v));
        const headers = isHeader ? firstRow : null;
        const rows = data.slice(isHeader ? 1 : 0);

        const numCols = firstRow.length;
        let zipIdx = 0;
        let countIdx = numCols >= 2 ? 1 : -1;
        let confidence = 'low';

        if (headers) {
          ({ zipIdx, countIdx, confidence } = detectColumns(headers));
        }

        resolve({ headers, rows, zipIdx, countIdx, confidence });
      },
      error: reject,
    });
  });
}

/**
 * Aggregate raw rows into [{zip, count}] using specified column indices.
 * countIdx = -1 means every row counts as 1.
 */
export function aggregateRows(rows, zipIdx, countIdx) {
  const agg = new Map();
  for (const row of rows) {
    const zip = normalizeZip(row[zipIdx]);
    if (!zip) continue;
    const raw = countIdx >= 0 ? parseFloat(row[countIdx]) : NaN;
    const count = isNaN(raw) || raw <= 0 ? 1 : raw;
    agg.set(zip, (agg.get(zip) ?? 0) + count);
  }
  return [...agg.entries()].map(([zip, count]) => ({ zip, count }));
}
