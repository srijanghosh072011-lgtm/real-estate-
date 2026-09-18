#!/usr/bin/env node
/**
 * CSV → listing markdown.
 *
 *   npm run import -- exports/listings.csv          write files
 *   npm run import -- exports/listings.csv --dry    print what would change
 *   npm run import -- --selftest                    run the parser check
 *
 * Point it at whatever your MLS, Follow Up Boss, kvCORE or Sierra export
 * produces. Header names are matched loosely (case and punctuation ignored),
 * so "List Price", "list_price" and "ListPrice" all land in `price`.
 *
 * Existing files are overwritten only when the CSV row differs, so re-running
 * a nightly sync is safe and produces an empty diff when nothing changed.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'listings');

/** CSV header (normalised) → frontmatter field. Add your own aliases here. */
const MAP = {
  address: ['address', 'streetaddress', 'unparsedaddress', 'fulladdress'],
  city: ['city', 'cityname'],
  region: ['state', 'stateorprovince', 'region'],
  postalCode: ['zip', 'zipcode', 'postalcode'],
  neighborhood: ['neighborhood', 'subdivision', 'subdivisionname'],
  price: ['price', 'listprice', 'currentprice'],
  status: ['status', 'mlsstatus', 'standardstatus'],
  propertyType: ['propertytype', 'type', 'propertysubtype'],
  beds: ['beds', 'bedrooms', 'bedroomstotal'],
  baths: ['baths', 'bathrooms', 'bathroomstotalinteger'],
  sqft: ['sqft', 'squarefeet', 'livingarea'],
  lotAcres: ['lotacres', 'lotsizeacres'],
  yearBuilt: ['yearbuilt'],
  hoaMonthly: ['hoa', 'hoafee', 'associationfee'],
  taxesAnnual: ['taxes', 'taxannualamount'],
  mls: ['mls', 'mlsnumber', 'listingid', 'listingkey'],
  listedOn: ['listedon', 'listdate', 'onmarketdate'],
  soldOn: ['soldon', 'closedate', 'closingdate'],
  soldPrice: ['soldprice', 'closeprice', 'sale price'],
  daysOnMarket: ['dom', 'daysonmarket'],
  agent: ['agent', 'listagentfullname'],
  heroImage: ['photo', 'heroimage', 'primaryphoto', 'photourl'],
  heroAlt: ['photoalt', 'heroalt'],
  title: ['title', 'headline', 'publicremarkstitle'],
  description: ['description', 'remarks', 'publicremarks'],
};

const STATUS = {
  active: 'for-sale',
  'for sale': 'for-sale',
  'for-sale': 'for-sale',
  pending: 'pending',
  'under contract': 'pending',
  'active under contract': 'pending',
  closed: 'sold',
  sold: 'sold',
  'coming soon': 'coming-soon',
  'coming-soon': 'coming-soon',
};

const TYPES = {
  'single family residence': 'house',
  'single family': 'house',
  house: 'house',
  residential: 'house',
  condominium: 'condo',
  condo: 'condo',
  townhouse: 'townhouse',
  land: 'land',
  'residential income': 'multifamily',
  multifamily: 'multifamily',
  duplex: 'multifamily',
};

/** RFC 4180-ish: quoted fields, escaped quotes, newlines inside quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const num = (v) => {
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};
const date = (v) => {
  const d = new Date(v);
  return isNaN(+d) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
};
const yaml = (v) => `"${String(v).replace(/"/g, '\\"')}"`;

export function rowToListing(record) {
  const get = (field) => {
    for (const alias of MAP[field] ?? []) {
      const key = Object.keys(record).find((k) => norm(k) === norm(alias));
      if (key && String(record[key]).trim() !== '') return String(record[key]).trim();
    }
    return undefined;
  };

  const address = get('address');
  if (!address) return null;

  const status = STATUS[(get('status') ?? '').toLowerCase()] ?? 'for-sale';
  const propertyType = TYPES[(get('propertyType') ?? '').toLowerCase()] ?? 'house';
  const beds = num(get('beds')) ?? 0;
  const baths = num(get('baths')) ?? 0;
  const sqft = num(get('sqft')) ?? 0;
  const city = get('city') ?? 'Wilmington';

  const front = {
    title: get('title') ?? `${beds} bedroom ${propertyType} in ${city}`,
    address,
    city,
    region: get('region') ?? 'NC',
    postalCode: get('postalCode') ?? '',
    neighborhood: get('neighborhood'),
    price: num(get('price')) ?? 0,
    status,
    propertyType,
    beds,
    baths,
    sqft,
    lotAcres: num(get('lotAcres')),
    yearBuilt: num(get('yearBuilt')),
    hoaMonthly: num(get('hoaMonthly')),
    taxesAnnual: num(get('taxesAnnual')),
    mls: get('mls'),
    featured: false,
    listedOn: date(get('listedOn') ?? new Date()),
    soldOn: get('soldOn') ? date(get('soldOn')) : undefined,
    soldPrice: num(get('soldPrice')),
    daysOnMarket: num(get('daysOnMarket')),
    agent: get('agent') ?? 'Avery Sinclair',
    heroImage: get('heroImage') ?? '',
    heroAlt: get('heroAlt') ?? `${address}, ${city} — exterior photograph`,
  };

  const lines = ['---'];
  for (const [k, v] of Object.entries(front)) {
    if (v === undefined || v === '') continue;
    lines.push(`${k}: ${typeof v === 'number' || typeof v === 'boolean' ? v : yaml(v)}`);
  }
  lines.push('---', '', get('description') ?? 'Details and photographs available on request.', '');

  return { slug: slugify(address), body: lines.join('\n') };
}

function selftest() {
  const rows = parseCsv('a,b\n"x,1","he said ""hi"""\n');
  assert.deepEqual(rows, [
    ['a', 'b'],
    ['x,1', 'he said "hi"'],
  ]);

  const out = rowToListing({
    'Street Address': '12 Test Lane',
    City: 'Leland',
    'List Price': '$425,000',
    MlsStatus: 'Active Under Contract',
    PropertyType: 'Condominium',
    Bedrooms: '3',
    Bathrooms: '2.5',
    LivingArea: '1,800',
  });
  assert.equal(out.slug, '12-test-lane');
  assert.match(out.body, /price: 425000/);
  assert.match(out.body, /status: "pending"/);
  assert.match(out.body, /propertyType: "condo"/);
  assert.match(out.body, /baths: 2.5/);
  assert.equal(rowToListing({ City: 'Leland' }), null);
  console.log('selftest: ok');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();

  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('usage: npm run import -- <file.csv> [--dry]');
    process.exit(1);
  }

  const dry = args.includes('--dry');
  const rows = parseCsv(readFileSync(file, 'utf8'));
  const [header, ...body] = rows;
  const records = body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));

  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const before = new Set(readdirSync(OUT));
  let written = 0;
  let skipped = 0;

  for (const record of records) {
    const listing = rowToListing(record);
    if (!listing) {
      skipped++;
      continue;
    }
    const path = join(OUT, `${listing.slug}.md`);
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (current === listing.body) continue;
    if (dry) console.log(`${current ? 'update' : 'create'}  ${listing.slug}.md`);
    else writeFileSync(path, listing.body);
    written++;
  }

  console.log(
    `${dry ? '[dry run] ' : ''}${written} listing file(s) ${dry ? 'would change' : 'written'}, ${skipped} row(s) skipped, ${before.size} already on disk.`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
