const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const formatPrice = (n: number) => usd.format(n);

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(d);

export const statusLabel = (s: string) =>
  ({ 'for-sale': 'For sale', pending: 'Under contract', sold: 'Sold', 'coming-soon': 'Coming soon' })[s] ?? s;
