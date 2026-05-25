// One-off script to regenerate src/data/sample-orders.csv
const fs = require('fs');
const path = require('path');

const zips = [
  {z:'90210',city:'Beverly Hills',st:'CA'},{z:'90001',city:'Los Angeles',st:'CA'},
  {z:'94102',city:'San Francisco',st:'CA'},{z:'92101',city:'San Diego',st:'CA'},
  {z:'95814',city:'Sacramento',st:'CA'},{z:'91201',city:'Glendale',st:'CA'},
  {z:'90045',city:'Los Angeles',st:'CA'},{z:'93401',city:'San Luis Obispo',st:'CA'},
  {z:'10001',city:'New York',st:'NY'},{z:'10002',city:'New York',st:'NY'},
  {z:'11201',city:'Brooklyn',st:'NY'},{z:'14201',city:'Buffalo',st:'NY'},
  {z:'11101',city:'Long Island City',st:'NY'},{z:'10301',city:'Staten Island',st:'NY'},
  {z:'77001',city:'Houston',st:'TX'},{z:'75201',city:'Dallas',st:'TX'},
  {z:'78201',city:'San Antonio',st:'TX'},{z:'79901',city:'El Paso',st:'TX'},
  {z:'76001',city:'Arlington',st:'TX'},{z:'78701',city:'Austin',st:'TX'},
  {z:'33101',city:'Miami',st:'FL'},{z:'33601',city:'Tampa',st:'FL'},
  {z:'32801',city:'Orlando',st:'FL'},{z:'32201',city:'Jacksonville',st:'FL'},
  {z:'60601',city:'Chicago',st:'IL'},{z:'60602',city:'Chicago',st:'IL'},
  {z:'62701',city:'Springfield',st:'IL'},
  {z:'98101',city:'Seattle',st:'WA'},{z:'98402',city:'Tacoma',st:'WA'},
  {z:'80202',city:'Denver',st:'CO'},{z:'80521',city:'Fort Collins',st:'CO'},
  {z:'30301',city:'Atlanta',st:'GA'},{z:'30303',city:'Atlanta',st:'GA'},
  {z:'02101',city:'Boston',st:'MA'},{z:'02134',city:'Allston',st:'MA'},
  {z:'85001',city:'Phoenix',st:'AZ'},{z:'85701',city:'Tucson',st:'AZ'},
  {z:'27601',city:'Raleigh',st:'NC'},{z:'28201',city:'Charlotte',st:'NC'},
  {z:'07001',city:'Avenel',st:'NJ'},{z:'07030',city:'Hoboken',st:'NJ'},
  {z:'43201',city:'Columbus',st:'OH'},{z:'44101',city:'Cleveland',st:'OH'},
  {z:'48201',city:'Detroit',st:'MI'},{z:'49503',city:'Grand Rapids',st:'MI'},
  {z:'55401',city:'Minneapolis',st:'MN'},{z:'55101',city:'St. Paul',st:'MN'},
  {z:'37201',city:'Nashville',st:'TN'},{z:'38101',city:'Memphis',st:'TN'},
  {z:'97201',city:'Portland',st:'OR'},{z:'97401',city:'Eugene',st:'OR'},
  {z:'89101',city:'Las Vegas',st:'NV'},{z:'89501',city:'Reno',st:'NV'},
  {z:'84101',city:'Salt Lake City',st:'UT'},{z:'84601',city:'Provo',st:'UT'},
  {z:'63101',city:'St. Louis',st:'MO'},{z:'64101',city:'Kansas City',st:'MO'},
  {z:'19101',city:'Philadelphia',st:'PA'},{z:'15201',city:'Pittsburgh',st:'PA'},
  {z:'53201',city:'Milwaukee',st:'WI'},{z:'53703',city:'Madison',st:'WI'},
  {z:'46201',city:'Indianapolis',st:'IN'},
  {z:'70112',city:'New Orleans',st:'LA'},{z:'70801',city:'Baton Rouge',st:'LA'},
  {z:'22201',city:'Arlington',st:'VA'},{z:'23220',city:'Richmond',st:'VA'},
  {z:'35201',city:'Birmingham',st:'AL'},{z:'36101',city:'Montgomery',st:'AL'},
  {z:'68102',city:'Omaha',st:'NE'},
  {z:'73101',city:'Oklahoma City',st:'OK'},{z:'74101',city:'Tulsa',st:'OK'},
  {z:'72201',city:'Little Rock',st:'AR'},
  {z:'83702',city:'Boise',st:'ID'},
  {z:'29201',city:'Columbia',st:'SC'},{z:'29401',city:'Charleston',st:'SC'},
  {z:'06101',city:'Hartford',st:'CT'},{z:'06510',city:'New Haven',st:'CT'},
  {z:'04101',city:'Portland',st:'ME'},
  {z:'96813',city:'Honolulu',st:'HI'},
  {z:'87101',city:'Albuquerque',st:'NM'},
  {z:'58101',city:'Fargo',st:'ND'},
  {z:'57101',city:'Sioux Falls',st:'SD'},
  {z:'59601',city:'Helena',st:'MT'},
  {z:'82001',city:'Cheyenne',st:'WY'},
  {z:'99501',city:'Anchorage',st:'AK'},
  {z:'05401',city:'Burlington',st:'VT'},
  {z:'03101',city:'Manchester',st:'NH'},
];

const products = [
  {name:'Hand-Painted Watercolor Print 8x10', sku:'WCP-8X10', lid:'1147823940', price:28.00},
  {name:'Personalized Wooden Name Sign',      sku:'PWS-NAM',  lid:'1147823941', price:45.00},
  {name:'Custom Portrait Illustration',       sku:'CPI-DIGI', lid:'1147823942', price:75.00},
  {name:'Macrame Wall Hanging Large',         sku:'MWH-LRG',  lid:'1147823943', price:68.00},
  {name:'Digital Wedding Invitation Template',sku:'DWI-TMPL', lid:'1147823944', price:18.00},
  {name:'Hand-Poured Soy Candle Set',         sku:'SCS-SET',  lid:'1147823945', price:32.00},
];

// Weighted: John/Jane Doe appear ~4x more often for a clear top-buyers chart
const customers = [
  'John Doe','John Doe','John Doe','John Doe',
  'Jane Doe','Jane Doe','Jane Doe','Jane Doe',
  'Alice Smith','Alice Smith','Alice Smith',
  'Robert Johnson','Robert Johnson',
  'Maria Garcia','Maria Garcia',
  'David Kim',
  'Sarah Mitchell',
  'Christopher Brown',
  'Emily Chen',
  'Michael Thompson',
];

// Weighted ZIP pool: high-population states appear more
const pool = [];
for (const z of zips) {
  const heavy = ['CA','NY','TX','FL','IL'].includes(z.st);
  const count = heavy ? 4 : 1;
  for (let i = 0; i < count; i++) pool.push(z);
}

// Simple LCG for reproducible output
let seed = 42;
function rand() {
  seed = ((seed * 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
}

const rows = [];
const startMs = new Date('2023-01-08').getTime();
const endMs   = new Date('2024-06-25').getTime();

for (let i = 0; i < 200; i++) {
  const date  = new Date(startMs + rand() * (endMs - startMs));
  const dateStr = date.toISOString().slice(0, 10);
  const loc   = pool[Math.floor(rand() * pool.length)];
  const cust  = customers[Math.floor(rand() * customers.length)];
  const prod  = products[Math.floor(rand() * products.length)];
  const qty   = rand() < 0.82 ? 1 : 2;
  const total = (prod.price * qty).toFixed(2);
  rows.push([dateStr, loc.z, loc.city, loc.st, cust, prod.name, prod.sku, prod.lid, qty, total, 'USD']);
}

rows.sort((a, b) => a[0].localeCompare(b[0]));

const header = 'Sale Date,Ship Zipcode,Ship City,Ship State,Full Name,Item Name,SKU,Listing ID,Quantity,Item Total,Currency';
const lines  = rows.map(r =>
  r.map((v, i) => [4, 5].includes(i) ? `"${v}"` : v).join(',')
);

const out = header + '\n' + lines.join('\n') + '\n';
const dest = path.join(__dirname, '..', 'src', 'data', 'sample-orders.csv');
fs.writeFileSync(dest, out, 'utf8');
console.log(`Written ${rows.length} rows to ${dest}`);
