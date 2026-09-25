const DAY = 24 * 60 * 60 * 1000;

export const isoDateIn = (days: number): string =>
  new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
