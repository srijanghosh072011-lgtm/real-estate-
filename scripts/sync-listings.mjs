#!/usr/bin/env node
/**
 * Pull listings from a CREA DDF® / IDX feed into data/listings.json.
 *
 *   DDF_URL=... DDF_USER=... DDF_PASS=... node scripts/sync-listings.mjs
 *
 * Most Canadian feed vendors (CREA DDF via their RETS/OData bridge, Redman,
 * MyRealPage, RealtyNinja) will hand you either RETS XML or a JSON endpoint.
 * This script targets the JSON shape; point `mapRecord` at whatever your
 * vendor actually returns and the rest of the site does not change.
 *
 * Run it on a schedule (GitHub Actions cron, see .github/workflows/sync.yml).
 * If anything changed it rewrites data/listings.json; the CI job then rebuilds
 * and redeploys. Nothing here touches the site templates.
 *
 * ponytail: no RETS client library. The vendor gives JSON over HTTPS; fetch
 * plus a mapping function is the whole job. Add a library only if you are
 * forced onto raw RETS/DMQL.
 */

import { readFile, writeFile } from 'node:fs/promises';

const { DDF_URL, DDF_USER, DDF_PASS, DDF_AGENT_ID } = process.env;
const DEST = 'data/listings.json';

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

const TYPE_MAP = {
  'Single Family': 'house',
  House: 'house',
  Apartment: 'condo',
  Condo: 'condo',
  'Row / Townhouse': 'townhouse',
  Townhouse: 'townhouse',
  Duplex: 'multi-family',
  'Multi-family': 'multi-family',
  Agriculture: 'acreage',
  'Vacant Land': 'acreage',
};

const STATUS_MAP = {
  Active: 'for-sale',
  'For sale': 'for-sale',
  Conditional: 'pending',
  Pending: 'pending',
  Sold: 'sold',
  Closed: 'sold',
};

/** Feed record -> the shape data/listings.json uses. Adjust field names to your vendor. */
function mapRecord(r) {
  const address = r.Property?.Address?.AddressLine1 || r.UnparsedAddress || '';
  const city = r.Property?.Address?.City || r.City || 'Regina';
  const price = Number(String(r.Property?.Price ?? r.ListPrice ?? 0).replace(/[^0-9.]/g, ''));

  return {
    mls: String(r.ListingKey || r.ListingID || r.MlsNumber),
    slug: slugify(`${address}-${city}`),
    title: address,
    status: STATUS_MAP[r.StandardStatus || r.Status] || 'for-sale',
    price,
    soldPrice: r.ClosePrice ? Number(r.ClosePrice) : undefined,
    type: TYPE_MAP[r.Property?.Type || r.PropertyType] || 'house',
    beds: Number(r.Building?.BedroomsTotal ?? r.BedroomsTotal ?? 0),
    baths: Number(r.Building?.BathroomTotal ?? r.BathroomsTotalInteger ?? 0),
    sqft: Number(String(r.Building?.SizeInterior ?? r.LivingArea ?? 0).replace(/[^0-9]/g, '')),
    lotSqft: Number(String(r.Land?.SizeTotal ?? r.LotSizeSquareFeet ?? 0).replace(/[^0-9]/g, '')),
    yearBuilt: Number(r.Building?.ConstructedDate ?? r.YearBuilt ?? 0) || null,
    garage: Number(r.ParkingSpaces?.Total ?? r.GarageSpaces ?? 0),
    taxes: Number(r.Property?.AnnualTax ?? r.TaxAnnualAmount ?? 0),
    condoFee: r.MaintenanceFee ? Number(r.MaintenanceFee) : undefined,
    neighbourhood: r.Property?.Neighbourhood || r.SubdivisionName || city,
    address,
    city,
    postalCode: r.Property?.Address?.PostalCode || r.PostalCode || '',
    lat: Number(r.Property?.Address?.Latitude ?? r.Latitude ?? 0),
    lng: Number(r.Property?.Address?.Longitude ?? r.Longitude ?? 0),
    featured: false,
    listedOn: (r.ListingContractDate || r.OriginalEntryTimestamp || new Date().toISOString()).slice(0, 10),
    soldOn: r.CloseDate ? r.CloseDate.slice(0, 10) : undefined,
    description: (r.PublicRemarks || r.Property?.Description || '').trim(),
    highlights: (r.Features || r.Building?.Features || []).slice(0, 6),
    images: (r.Property?.Photo || r.Media || [])
      .map((p) => p.HighResPath || p.LargePhoto || p.MediaURL)
      .filter(Boolean)
      .slice(0, 12),
  };
}

/** Strip undefined keys so the JSON file stays clean and diffs stay readable. */
const prune = (o) => JSON.parse(JSON.stringify(o));

function validate(l) {
  const problems = [];
  if (!l.mls) problems.push('missing MLS number');
  if (!l.slug) problems.push('missing slug');
  if (!(l.price > 0)) problems.push('missing price');
  if (!l.images.length) problems.push('no photos');
  if (!l.description) problems.push('no description');
  return problems;
}

async function main() {
  if (!DDF_URL) {
    console.error(
      'DDF_URL is not set.\n' +
        'Set DDF_URL, DDF_USER and DDF_PASS (from your CREA DDF or IDX vendor) and run again.\n' +
        'Until then data/listings.json is edited by hand and the site builds fine.'
    );
    process.exit(1);
  }

  const url = new URL(DDF_URL);
  if (DDF_AGENT_ID) url.searchParams.set('agent', DDF_AGENT_ID);

  const headers = { Accept: 'application/json' };
  if (DDF_USER) headers.Authorization = 'Basic ' + Buffer.from(`${DDF_USER}:${DDF_PASS}`).toString('base64');

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`feed returned ${res.status} ${res.statusText}`);

  const raw = await res.json();
  const records = raw.value || raw.Results || raw.listings || raw;
  if (!Array.isArray(records)) throw new Error('unexpected feed shape: expected an array of listings');

  const seen = new Set();
  const listings = [];
  let skipped = 0;

  for (const r of records) {
    const l = prune(mapRecord(r));
    const problems = validate(l);
    if (problems.length) {
      console.warn(`skipped ${l.mls || '(no id)'}: ${problems.join(', ')}`);
      skipped++;
      continue;
    }
    // Two units at one address would collide; suffix the duplicate with its MLS number.
    if (seen.has(l.slug)) l.slug = `${l.slug}-${l.mls.toLowerCase()}`;
    seen.add(l.slug);
    listings.push(l);
  }

  // Keep manual overrides: anything flagged featured by hand stays featured.
  const previous = JSON.parse(await readFile(DEST, 'utf8')).listings;
  const featured = new Set(previous.filter((p) => p.featured).map((p) => p.mls));
  listings.forEach((l) => {
    if (featured.has(l.mls)) l.featured = true;
  });

  const next = { source: 'ddf', updatedAt: new Date().toISOString(), listings };
  const before = await readFile(DEST, 'utf8');
  const after = JSON.stringify(next, null, 2) + '\n';

  // Compare listings only — updatedAt always differs and would force a commit every run.
  if (JSON.stringify(JSON.parse(before).listings) === JSON.stringify(listings)) {
    console.log('no listing changes');
    return;
  }

  await writeFile(DEST, after);
  console.log(`wrote ${listings.length} listings (${skipped} skipped) to ${DEST}`);
}

main().catch((e) => {
  console.error('sync failed:', e.message);
  process.exit(1);
});
