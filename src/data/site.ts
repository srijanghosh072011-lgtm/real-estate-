/**
 * Every client-specific string lives here. Rebrand the whole site from this file.
 * Nothing secret belongs in it — it ships to the browser.
 */
export const site = {
  name: 'Harbor Lane Realty',
  legalName: 'Harbor Lane Realty LLC',
  tagline: 'Coastal Carolina homes, handled properly.',
  description:
    'Harbor Lane Realty helps buyers and sellers across Wilmington, Wrightsville Beach and Leland move with less friction — accurate pricing, negotiated repairs and 12 days median time to contract.',
  url: 'https://www.harborlane.realestate',
  phone: '(910) 555-0148',
  phoneHref: 'tel:+19105550148',
  email: 'hello@harborlane.realestate',
  license: 'NC Firm License C-38217',
  brokerage: 'Harbor Lane Realty LLC',
  address: {
    street: '212 Princess Street, Suite 4',
    city: 'Wilmington',
    region: 'NC',
    postalCode: '28401',
    country: 'US',
  },
  geo: { lat: 34.2373, lng: -77.9481 },
  hours: [
    { days: 'Monday – Friday', time: '8:30am – 6:30pm' },
    { days: 'Saturday', time: '9:00am – 4:00pm' },
    { days: 'Sunday', time: 'By appointment' },
  ],
  social: {
    instagram: 'https://www.instagram.com/',
    facebook: 'https://www.facebook.com/',
    linkedin: 'https://www.linkedin.com/',
    youtube: 'https://www.youtube.com/',
  },
  /** Replace with a 1200×630 image of your own; used for OpenGraph + Twitter cards. */
  ogImage: '/og-cover.png',
  serviceAreas: [
    'Wilmington',
    'Wrightsville Beach',
    'Carolina Beach',
    'Leland',
    'Hampstead',
    'Ogden',
    'Porters Neck',
    'Castle Hayne',
  ],
  ratings: { value: 4.9, count: 213 },
  /**
   * Where lead forms POST. Formspree / Web3Forms / Netlify Forms all work —
   * whatever you use must also appear in the CSP `form-action` in public/_headers.
   * Empty string = forms stay inert and tell the visitor to call instead.
   */
  formEndpoint: 'https://formspree.io/f/REPLACE_ME',
  /** Optional: booking link used by the "Book a call" buttons. */
  bookingUrl: '',
  analytics: {
    /** Plausible: set to your domain to switch it on. Self-hosted? change the script host too. */
    plausibleDomain: '',
    /** GA4: 'G-XXXXXXX'. Leave blank to skip Google entirely. */
    ga4Id: '',
  },
};

export const nav = [
  { label: 'Buy', href: '/buy' },
  { label: 'Sell', href: '/sell' },
  { label: 'Listings', href: '/listings' },
  { label: 'Neighborhoods', href: '/neighborhoods' },
  { label: 'Guides', href: '/guides' },
  { label: 'About', href: '/about' },
];

export const stats = [
  { value: '$412M', label: 'Closed volume since 2016' },
  { value: '12', label: 'Median days to contract' },
  { value: '98.7%', label: 'List-to-sale price ratio' },
  { value: '213', label: 'Five-star client reviews' },
];

export const services = [
  {
    title: 'Selling a home',
    href: '/sell',
    summary:
      'Pricing built from last week\'s comparable sales, prep work fronted by us, and a launch calendar that puts your home in front of buyers before the first open house.',
    points: ['Staging + photography included', 'Pre-list inspection', 'Offer review in plain English'],
  },
  {
    title: 'Buying a home',
    href: '/buy',
    summary:
      'Off-market introductions, honest walkthrough notes on what the listing photos hide, and negotiation that treats your inspection findings as leverage.',
    points: ['Off-market access', 'Same-day tour scheduling', 'Repair credit negotiation'],
  },
  {
    title: 'Investment & relocation',
    href: '/contact',
    summary:
      'Rent-roll modelling for small multifamily, short-term rental permit checks, and relocation support for families landing from out of state.',
    points: ['Cash-flow modelling', 'STR permit verification', 'Remote closing support'],
  },
];

export const process = [
  {
    step: '01',
    title: 'Strategy call',
    body: 'Twenty minutes on the phone. We look at your timeline, your number and what is actually selling on your street right now.',
  },
  {
    step: '02',
    title: 'Plan and prep',
    body: 'Sellers get a prep list with our vendors and costs fronted. Buyers get a shortlist and a financing introduction the same week.',
  },
  {
    step: '03',
    title: 'Go to market',
    body: 'Photography, floor plans, drone and a coordinated launch across MLS, syndication and our buyer list within 72 hours.',
  },
  {
    step: '04',
    title: 'Negotiate and close',
    body: 'Offers compared side by side on terms, not just price. We manage inspection, appraisal and closing dates to the day.',
  },
];

export const differentiators = [
  {
    title: 'Pricing you can audit',
    body: 'Every recommendation comes with the comparable sales behind it, so you can see how we got to the number instead of taking it on faith.',
  },
  {
    title: 'Prep costs fronted',
    body: 'Paint, staging, landscaping and repairs are paid up front by the brokerage and settled at closing. No out-of-pocket to get listed.',
  },
  {
    title: 'One agent, start to finish',
    body: 'The person you meet is the person at your inspection and your closing table. Nothing gets handed off to a coordinator you never met.',
  },
  {
    title: 'Answers within the hour',
    body: 'Calls and messages during business hours get a human reply inside 60 minutes. Offers get answered the day they land.',
  },
];

export const testimonials = [
  {
    quote:
      'They priced our Sunset Park bungalow $15k above what two other agents suggested and it went under contract in nine days. The prep list was specific enough that we knew exactly what mattered.',
    name: 'Dana & Miles Rutherford',
    role: 'Sold in Sunset Park',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=70',
  },
  {
    quote:
      'We were relocating from Ohio and bought sight-unseen. The walkthrough video called out a soft spot in the sunroom floor that the listing photos hid completely, and that became a $9,400 credit.',
    name: 'Priya Raman',
    role: 'Bought in Porters Neck',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=70',
  },
  {
    quote:
      'Third property I have bought with them. They talked me out of one deal that looked fine on paper because the STR permit would not transfer. That honesty is why I keep calling.',
    name: 'Curtis Bellamy',
    role: 'Investor, Carolina Beach',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=70',
  },
];

export const team = [
  {
    name: 'Avery Sinclair',
    role: 'Broker-in-Charge',
    bio: 'Fifteen years in New Hanover County and a former residential appraiser, which is why pricing conversations here start with data instead of a guess.',
    photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=75',
    email: 'avery@harborlane.realestate',
  },
  {
    name: 'Marcus Devlin',
    role: 'Listing Specialist',
    bio: 'Runs prep and launch for every seller: vendors, timelines, photography and the first-72-hours push that decides how a listing performs.',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=75',
    email: 'marcus@harborlane.realestate',
  },
  {
    name: 'Joelle Nakamura',
    role: 'Buyer Advocate',
    bio: 'Handles relocation and first-time buyers. Reads inspection reports for a living and negotiates the repair credits most people leave behind.',
    photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=75',
    email: 'joelle@harborlane.realestate',
  },
];

/** Answer-engine fodder: short, factual, quotable. Rendered as FAQPage schema. */
export const faqs = [
  {
    q: 'What commission does Harbor Lane Realty charge?',
    a: 'Listing fees start at 2.5% of the sale price, and buyer-agent compensation is negotiated separately on every transaction since the 2024 NAR settlement rules took effect. Fees are set in writing before any marketing begins, and prep costs we front are repaid at closing with no interest or markup.',
  },
  {
    q: 'How long does it take to sell a home in Wilmington, NC?',
    a: 'Our listings went under contract in a median of 12 days over the last 12 months, against a New Hanover County median closer to 31 days. Total time from listing to closing typically runs 40 to 55 days, with financing and appraisal taking most of the calendar after contract.',
  },
  {
    q: 'Do I need to pay for staging or repairs before listing?',
    a: 'No. Harbor Lane fronts the cost of paint, staging, landscaping and pre-list repairs up to $12,000, then settles it from proceeds at closing. If the home does not sell, you owe nothing for the work we commissioned.',
  },
  {
    q: 'Can you help if I am buying from out of state?',
    a: 'Yes. Roughly a third of our buyers purchase remotely. You get a narrated walkthrough video for each property, a same-day summary of defects the photos hide, and a fully remote closing with a mobile notary if you cannot travel.',
  },
  {
    q: 'Which areas do you cover?',
    a: 'Wilmington, Wrightsville Beach, Carolina Beach, Leland, Hampstead, Ogden, Porters Neck and Castle Hayne. We do not list outside New Hanover, Brunswick and Pender counties, because local pricing knowledge stops being reliable past that line.',
  },
  {
    q: 'How accurate is the instant home valuation on this site?',
    a: 'The instant estimate uses recent neighborhood sales and your square footage, so it lands within roughly 8% for typical homes. Waterfront, heavily renovated and unusual properties need a human review — we send a corrected figure with the comparable sales attached within one business day.',
  },
];
