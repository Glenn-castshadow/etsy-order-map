import Papa from 'papaparse';

// ── Column alias tables ────────────────────────────────────────────────────

const ZIP_ALIASES = new Set([
  // Etsy
  'Ship Zipcode', 'Ship Zip', 'Shipping Zip Code', 'Shipping Zip',
  'Zip', 'ZIP', 'Zip Code', 'ZipCode', 'zip_code',
  'Postal Code', 'PostalCode', 'postal_code',
  'Billing Zip', 'shipping_postcode', 'billing_postcode',
  // eBay Seller Hub Orders report (confirmed field name)
  'Buyer Zip', 'Zip Code',
  // Poshmark sales CSV (confirmed field name)
  'Buyer Zip Code',
  // BrickLink order export
  'Buyer Postal Code', 'Ship Postal Code', 'Postal Code',
]);

const COUNT_ALIASES = new Set([
  'Quantity', 'Qty', 'Count', 'Orders', 'Sales', 'Items', 'Units',
  'Number of Items', 'Item Count',
  // eBay
  'Quantity Sold', 'Total Quantity',
]);

const DATE_ALIASES = new Set([
  'Sale Date', 'Order Date', 'Date', 'Created At', 'Transaction Date',
  'Sold Date', 'Purchase Date', 'sale_date', 'order_date', 'created_at',
  // eBay Seller Hub
  'Paid on Date', 'Checkout Date',
  // BrickLink
  'Date Ordered',
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

  // MM/DD/YYYY  or  MM/DD/YY  (Etsy's Sold Orders export uses 2-digit years)
  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (mdy) {
    let year = mdy[3];
    if (year.length === 2) {
      // Common pivot:  00–69 → 2000–2069,  70–99 → 1970–1999
      const yn = parseInt(year, 10);
      year = String(yn < 70 ? 2000 + yn : 1900 + yn);
    }
    return `${year}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }

  // MMM-DD-YYYY  /  MMM DD, YYYY  /  Month DD, YYYY
  // (Jan-15-2024, Jan 15, 2024, January 2, 2026)
  const named = str.match(/^([A-Za-z]{3,})[-\s](\d{1,2})[,\s-]+(\d{4})$/);
  if (named) {
    const m = MONTH_MAP[named[1].slice(0, 3).toLowerCase()];
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

/**
 * Heuristic: does this look like Etsy's "Direct Checkout Payments" export?
 * That file has no shipping address — it's payment ledger data — so we want
 * to point users at the Orders / Sold Orders export instead of failing
 * silently with "no ZIPs found".
 */
function looksLikeEtsyPaymentsCsv(headers) {
  if (!headers) return false;
  const has = (name) => headers.some(h => h.toLowerCase() === name.toLowerCase());
  return has('Payment ID')
      && has('Posted Gross')
      && !headers.some(h => ZIP_REGEX.test(h));
}

/**
 * Heuristic: does this look like Etsy's "Deposits" export?
 * Distinctive header: "Bank Account Ending Digits" — no other Etsy CSV
 * uses that.  Columns are just Date / Amount / Currency / Status, so this
 * routes to a financial dashboard view (no map possible).
 */
function looksLikeEtsyDepositsCsv(headers) {
  if (!headers) return false;
  return headers.some(h => /bank account ending/i.test(h));
}

/**
 * eBay Seller Hub "Orders" report CSV.
 * Confirmed distinctive columns: "Sales Record Number" + "Buyer Username" +
 * "Buyer Zip" (or "Zip Code").  eBay's report also always has "Item Title".
 */
function looksLikeEbayCsv(headers) {
  if (!headers) return false;
  const has = (re) => headers.some(h => re.test(h));
  return has(/sales\s*record\s*number/i)
      && has(/buyer\s*username/i);
}

/**
 * Poshmark "My Sales Report" CSV.
 * Confirmed columns (from real export): "Order Id", "Listing Title",
 * "Net Earnings", "Buyer Zip Code", "Buyer Username", "Bundle Order?".
 * Poshmark DOES include buyer ZIP — routes to orders (map + charts).
 */
function looksLikePoshmarkCsv(headers) {
  if (!headers) return false;
  const has = (re) => headers.some(h => re.test(h));
  return has(/^order\s*id$/i)
      && has(/net\s*earnings/i)
      && has(/buyer\s*zip\s*code/i);
}

/**
 * BrickLink "Orders Received" export CSV.
 * Distinctive: "Order ID" + "Date Ordered" + "Grand Total" with no
 * "Sales Record Number" (eBay's marker) and no "Net Earnings" (Poshmark's).
 * BrickLink uses "Buyer Username" for the buyer handle.
 */
function looksLikeBrickLinkCsv(headers) {
  if (!headers) return false;
  const has = (re) => headers.some(h => re.test(h));
  return has(/^order\s*id$/i)
      && has(/date\s*ordered/i)
      && has(/grand\s*total/i)
      && !has(/sales\s*record\s*number/i)
      && !has(/net\s*earnings/i);
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

        let kind = null;
        if      (looksLikeEtsyPaymentsCsv(headers))  kind = 'etsy-payments';
        else if (looksLikeEtsyDepositsCsv(headers))  kind = 'etsy-deposits';
        else if (looksLikePoshmarkCsv(headers))       kind = 'poshmark-sales';
        else if (looksLikeEbayCsv(headers))           kind = 'ebay-orders';
        else if (looksLikeBrickLinkCsv(headers))      kind = 'bricklink-orders';

        resolve({ headers, rows, zipIdx, countIdx, dateIdx, confidence, kind });
      },
      error: (err) => {
        console.error('[ZipMap] PapaParse error', {
          file: file.name, size: file.size, type: file.type, error: err,
        });
        reject(err instanceof Error ? err : new Error(String(err?.message ?? err)));
      },
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

// ── Payments CSV (Etsy Direct Checkout Payments) ───────────────────────────

/**
 * Aggregate Etsy payments rows across one or more files into the data the
 * PaymentsView needs.  Each file resolves its column indices independently
 * from its own headers, so files with re-ordered columns still combine
 * correctly.  Optionally filtered by date range (YYYY-MM-DD inclusive).
 *
 * @param {Array<{headers: string[], rows: string[][]}>} files
 * @param {string|null} fromDate
 * @param {string|null} toDate
 */
export function aggregatePayments(files, fromDate = null, toDate = null) {
  const totals = { gross: 0, fees: 0, net: 0, refund: 0, orderCount: 0 };
  const byMonth   = new Map();   // 'YYYY-MM' → { gross, fees, net, refund, count }
  const byBuyer   = new Map();   // buyer → { gross, count }
  const byStatus  = new Map();   // status → count
  const byProduct = new Map();   // item name (or SKU) → { name, sku, listingId, quantity, revenue, orderCount }
  const byWeekday = Array.from({ length: 7 }, () => ({ count: 0, revenue: 0 })); // 0=Sun … 6=Sat
  let minDate = null, maxDate = null;
  let currency = null;

  for (const file of files) {
    const headers = file.headers;
    const rows    = file.rows;
    // Match column names across Etsy, eBay, Poshmark, and BrickLink exports.
    const idxAny = (...names) => {
      for (const name of names) {
        const i = headers.findIndex(h => h?.toLowerCase() === name.toLowerCase());
        if (i >= 0) return i;
      }
      return -1;
    };
    const iGross   = idxAny(
      // Etsy
      'Gross Amount', 'Order Total', 'Item Total', 'Order Value', 'Amount',
      // eBay (Seller Hub Orders report)
      'Sale Price', 'Total Price', 'Gross Sales',
      // Poshmark (confirmed field name)
      'Order Price',
      // BrickLink
      'Grand Total', 'Sub Total',
    );
    const iFees    = idxAny(
      'Fees', 'Card Processing Fees',
      // eBay
      'Final Value Fee', 'eBay Fee',
      // Poshmark (shipping label cost)
      'Upgraded Shipping Label Fee',
    );
    const iNet     = idxAny(
      'Net Amount', 'Order Net', 'Adjusted Net Order Amount',
      // Poshmark (confirmed field name)
      'Net Earnings',
      'Earnings', 'Seller Proceeds',
    );
    const iRefund  = idxAny('Refund Amount', 'Refund', 'Cancelled Amount');
    const iDate    = idxAny(
      // Etsy / generic
      'Order Date', 'Sale Date', 'Date', 'Transaction Date',
      // eBay Seller Hub
      'Paid on Date', 'Checkout Date',
      // BrickLink
      'Date Ordered',
    );
    const iBuyer   = idxAny('Buyer', 'Buyer Username');
    const iBuyerNm = idxAny('Buyer Name', 'Full Name', 'Ship Name', 'Shipping Recipient');
    const iStatus  = idxAny('Status', 'Order Status');
    const iCur     = idxAny('Currency', 'Currency Code');
    // Product-level columns
    const iItemNm  = idxAny(
      'Item Name', 'Item Title', 'Title',
      // Poshmark
      'Listing Title',
      // eBay
      'Product',
      'Description',
    );
    const iQty     = idxAny('Quantity', 'Qty', 'Number of Items', 'Quantity Sold', 'Total Quantity');
    const iSku     = idxAny('SKU', 'Custom Label', 'Item Number');
    const iListing = idxAny('Listing ID');

    for (const row of rows) {
      const date = parseIsoDate(row[iDate]);
      if (!date) continue;
      if (fromDate && date < fromDate) continue;
      if (toDate   && date > toDate)   continue;

      const gross  = +parseFloat(row[iGross])  || 0;
      const fees   = +parseFloat(row[iFees])   || 0;
      const net    = +parseFloat(row[iNet])    || 0;
      const refund = +parseFloat(row[iRefund]) || 0;

      totals.gross  += gross;
      totals.fees   += fees;
      totals.net    += net;
      totals.refund += refund;
      totals.orderCount += 1;

      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
      if (!currency && iCur >= 0) currency = (row[iCur] || '').trim() || null;

      const ym = date.slice(0, 7);
      const m = byMonth.get(ym) ?? { gross: 0, fees: 0, net: 0, refund: 0, count: 0 };
      m.gross  += gross;
      m.fees   += fees;
      m.net    += net;
      m.refund += refund;
      m.count  += 1;
      byMonth.set(ym, m);

      // Day-of-week tally — parse the YYYY-MM-DD parts manually so the
      // weekday is independent of timezone.
      const [dy, dm, dd] = date.split('-').map(Number);
      const dow = new Date(dy, dm - 1, dd).getDay();
      byWeekday[dow].count   += 1;
      byWeekday[dow].revenue += gross;

      const buyerRaw = (iBuyer >= 0 ? row[iBuyer] : '') || (iBuyerNm >= 0 ? row[iBuyerNm] : '') || '—';
      const buyer = String(buyerRaw).trim() || '—';
      const b = byBuyer.get(buyer) ?? { gross: 0, count: 0 };
      b.gross += gross;
      b.count += 1;
      byBuyer.set(buyer, b);

      if (iStatus >= 0) {
        const s = String(row[iStatus] || '—').trim();
        byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
      }

      // Per-product aggregation — works when the file has Item Name or SKU
      const productName = iItemNm >= 0 ? String(row[iItemNm] || '').trim() : '';
      const productSku  = iSku    >= 0 ? String(row[iSku]    || '').trim() : '';
      const productKey  = productName || productSku;
      if (productKey) {
        const qty = iQty >= 0 ? +parseFloat(row[iQty]) || 1 : 1;
        let p = byProduct.get(productKey);
        if (!p) {
          p = {
            name:       productName || productSku,
            sku:        productSku,
            listingId:  iListing >= 0 ? String(row[iListing] || '').trim() : '',
            quantity:   0,
            revenue:    0,
            orderCount: 0,
          };
          byProduct.set(productKey, p);
        }
        p.quantity   += qty;
        p.revenue    += gross;
        p.orderCount += 1;
      }
    }
  }

  // Fill month gaps so the chart has a continuous x-axis
  const months = fillMonthRange(minDate, maxDate).map(ym => ({
    month: ym,
    ...(byMonth.get(ym) ?? { gross: 0, fees: 0, net: 0, refund: 0, count: 0 }),
  }));

  const topBuyers = [...byBuyer.entries()]
    .map(([buyer, v]) => ({ buyer, gross: v.gross, count: v.count }))
    .sort((a, b) => b.gross - a.gross)
    .slice(0, 10);

  const statusBreakdown = [...byStatus.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Top 10 products by revenue (only populated when the import had Item
  // Name or SKU columns — i.e. an Etsy Sold Order Items CSV).
  const topProducts = [...byProduct.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  totals.avgOrder = totals.orderCount > 0 ? totals.gross / totals.orderCount : 0;

  const weekdayBreakdown = byWeekday.map((v, i) => ({ dow: i, count: v.count, revenue: v.revenue }));

  return {
    totals,
    months,
    topBuyers,
    topProducts,
    statusBreakdown,
    weekdayBreakdown,
    dateRange: minDate && maxDate ? { min: minDate, max: maxDate } : null,
    currency: currency ?? 'USD',
  };
}

function fillMonthRange(min, max) {
  if (!min || !max) return [];
  const out = [];
  let [y, m] = min.slice(0, 7).split('-').map(Number);
  const [ey, em] = max.slice(0, 7).split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/**
 * Build a per-ZIP detail map for the click-to-inspect popup.  Returns a Map
 * keyed by ZIP →  { zip, city, state, orders, totalValue, totalItems,
 *                  customers (Set), skus (Set) }.
 *
 * Each file uses its own zip/count/date indices.  Extra detail columns
 * (Full Name, Order Total, SKU, Ship City, Ship State) are looked up by
 * header name with sensible aliases.
 *
 * @param {Array} files            csvFiles array (orders kind)
 * @param {string|null} fromDate
 * @param {string|null} toDate
 */
export function aggregateZipDetails(files, fromDate = null, toDate = null) {
  const out = new Map();

  for (const file of files) {
    if (file.kind === 'etsy-payments') continue;
    const { headers, rows, zipIdx, countIdx, dateIdx } = file;
    const idxAny = (...names) => {
      for (const name of names) {
        const i = headers?.findIndex(h => h?.toLowerCase() === name.toLowerCase());
        if (i != null && i >= 0) return i;
      }
      return -1;
    };
    const iCustomer = idxAny(
      'Full Name', 'Ship Name', 'Buyer Name', 'Buyer', 'Customer',
      'Buyer Username',                         // eBay / Poshmark / BrickLink
      'Shipping Recipient',
    );
    const iTotal    = idxAny(
      'Item Total', 'Order Total', 'Order Value', 'Total', 'Gross Amount',
      'Total Price', 'Sale Price',              // eBay
      'Order Price',                            // Poshmark
      'Grand Total',                            // BrickLink
    );
    const iItemNm   = idxAny('Item Name', 'Item Title', 'Title', 'Listing Title', 'Product', 'Description');
    const iSku      = idxAny('SKU', 'Custom Label', 'Item Number', 'Item');
    const iCity     = idxAny('Ship City', 'City', 'Buyer City', 'Shipping City');
    const iState    = idxAny('Ship State', 'State', 'Buyer State', 'Province', 'Shipping State');

    for (const row of rows) {
      if (dateIdx >= 0 && (fromDate || toDate)) {
        const d = parseIsoDate(row[dateIdx]);
        if (d) {
          if (fromDate && d < fromDate) continue;
          if (toDate   && d > toDate)   continue;
        }
      }
      const zip = normalizeZip(row[zipIdx]);
      if (!zip) continue;

      let entry = out.get(zip);
      if (!entry) {
        entry = {
          zip,
          city:       iCity  >= 0 ? String(row[iCity]  || '').trim() : '',
          state:      iState >= 0 ? String(row[iState] || '').trim() : '',
          orders:     [],
          totalValue: 0,
          totalItems: 0,
          customers:  new Set(),
          skus:       new Set(),
        };
        out.set(zip, entry);
      }

      const total    = iTotal    >= 0 ? +parseFloat(row[iTotal])    || 0 : 0;
      const items    = countIdx  >= 0 ? +parseFloat(row[countIdx])  || 1 : 1;
      const customer = iCustomer >= 0 ? String(row[iCustomer] || '').trim() : '';
      const itemName = iItemNm   >= 0 ? String(row[iItemNm] || '').trim() : '';
      const sku      = iSku      >= 0 ? String(row[iSku] || '').trim() : '';
      const product  = itemName || sku;
      const date     = dateIdx   >= 0 ? parseIsoDate(row[dateIdx]) : null;

      entry.orders.push({ date, customer: customer || '—', items, total, product, sku: product });
      entry.totalValue += total;
      entry.totalItems += items;
      if (customer) entry.customers.add(customer);
      if (product)  entry.skus.add(product);
    }
  }

  // Sort each ZIP's orders by date (newest first) for nicer popup display
  for (const entry of out.values()) {
    entry.orders.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }
  return out;
}

// ── Internal ───────────────────────────────────────────────────────────────

export function normalizeZip(val) {
  if (val == null) return null;
  let s = String(val).trim().replace(/\.0+$/, '');
  if (!s) return null;
  // Strip ZIP+4 suffix ("48124-1023" → "48124"); Etsy's Sold Orders export
  // emits this format whenever the buyer provided one.
  const dash = s.indexOf('-');
  if (dash > 0) s = s.slice(0, dash);
  s = s.trim();
  // Concatenated ZIP+4 with no dash (e.g. "605131236" → "60513")
  if (s.length === 9 && /^\d{9}$/.test(s)) s = s.slice(0, 5);
  if (s.length < 3 || s.length > 5 || !/^\d+$/.test(s)) return null;
  return s.padStart(5, '0');
}
