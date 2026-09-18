import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Listings are plain markdown files in src/content/listings.
 * Agents edit them in /admin (Sveltia CMS) or via scripts/import-listings.mjs.
 */
const listings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/listings' }),
  schema: z.object({
    title: z.string(),
    address: z.string(),
    city: z.string(),
    region: z.string().default('NC'),
    postalCode: z.string(),
    neighborhood: z.string().optional(),
    price: z.number(),
    status: z.enum(['for-sale', 'pending', 'sold', 'coming-soon']).default('for-sale'),
    propertyType: z.enum(['house', 'condo', 'townhouse', 'land', 'multifamily']).default('house'),
    beds: z.number(),
    baths: z.number(),
    sqft: z.number(),
    lotAcres: z.number().optional(),
    yearBuilt: z.number().optional(),
    hoaMonthly: z.number().optional(),
    taxesAnnual: z.number().optional(),
    mls: z.string().optional(),
    featured: z.boolean().default(false),
    listedOn: z.coerce.date(),
    soldOn: z.coerce.date().optional(),
    soldPrice: z.number().optional(),
    daysOnMarket: z.number().optional(),
    agent: z.string().default('Avery Sinclair'),
    heroImage: z.string(),
    heroAlt: z.string(),
    gallery: z.array(z.object({ src: z.string(), alt: z.string() })).default([]),
    highlights: z.array(z.string()).default([]),
    tourUrl: z.string().url().optional(),
  }),
});

const neighborhoods = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/neighborhoods' }),
  schema: z.object({
    title: z.string(),
    city: z.string(),
    summary: z.string(),
    medianPrice: z.number(),
    medianDom: z.number(),
    pricePerSqft: z.number(),
    priceTrend: z.string(),
    heroImage: z.string(),
    heroAlt: z.string(),
    goodFor: z.array(z.string()).default([]),
    schools: z.array(z.string()).default([]),
    order: z.number().default(10),
    updated: z.coerce.date(),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['Selling', 'Buying', 'Market report', 'Investing']),
    author: z.string().default('Avery Sinclair'),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    heroImage: z.string(),
    heroAlt: z.string(),
    readMinutes: z.number().default(6),
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

export const collections = { listings, neighborhoods, guides };
