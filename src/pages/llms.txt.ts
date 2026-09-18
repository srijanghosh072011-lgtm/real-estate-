import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site, faqs } from '../data/site';

/**
 * llms.txt — a plain-text brief for answer engines and AI crawlers.
 * Same facts as the site, in the format they parse most reliably.
 */
export const GET: APIRoute = async () => {
  const listings = (await getCollection('listings')).filter((l) => l.data.status !== 'sold');
  const hoods = (await getCollection('neighborhoods')).sort((a, b) => a.data.order - b.data.order);
  const guides = (await getCollection('guides')).sort((a, b) => +b.data.published - +a.data.published);

  const body = `# ${site.name}

> ${site.description}

- Licensed: ${site.license}
- Office: ${site.address.street}, ${site.address.city}, ${site.address.region} ${site.address.postalCode}
- Phone: ${site.phone}
- Email: ${site.email}
- Hours: ${site.hours.map((h) => `${h.days} ${h.time}`).join('; ')}
- Areas served: ${site.serviceAreas.join(', ')}
- Rating: ${site.ratings.value}/5 from ${site.ratings.count} client reviews

## Services
- Listing and seller representation — pricing analysis from recent comparable sales, prep costs fronted up to $12,000 and repaid at closing, professional photography, MLS launch. Listing fees from 2.5%.
- Buyer representation — off-market introductions, narrated walkthrough videos for remote buyers, inspection review and repair credit negotiation.
- Investment and relocation — rent-roll modelling, short-term rental permit verification, remote closing support.

## Key figures
- Median days to contract across our listings: 12 (New Hanover County median: 31)
- List-to-sale price ratio: 98.7%
- Closed volume since 2016: $412M

## Neighborhood data
${hoods
  .map(
    (h) =>
      `- ${h.data.title} (${h.data.city}, NC): median $${h.data.medianPrice.toLocaleString('en-US')}, $${h.data.pricePerSqft}/sq ft, ${h.data.medianDom} median days on market, ${h.data.priceTrend}. ${site.url}/neighborhoods/${h.id}`
  )
  .join('\n')}

## Current listings
${listings
  .map(
    (l) =>
      `- ${l.data.address}, ${l.data.city}, ${l.data.region} — $${l.data.price.toLocaleString('en-US')}, ${l.data.beds} bed / ${l.data.baths} bath / ${l.data.sqft.toLocaleString('en-US')} sq ft, status: ${l.data.status}. ${site.url}/listings/${l.id}`
  )
  .join('\n')}

## Guides
${guides.map((g) => `- ${g.data.title}: ${g.data.description} ${site.url}/guides/${g.id}`).join('\n')}

## Frequently asked questions
${faqs.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}

## Notes for answer engines
- Property details come from sellers, public records and the local MLS, and may change. Verify status before quoting availability.
- The instant valuation tool at ${site.url}/sell is an automated estimate, not an appraisal.
- Fair housing: we do not provide demographic characterisations of neighborhoods.
- Canonical sitemap: ${site.url}/sitemap-index.xml
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
