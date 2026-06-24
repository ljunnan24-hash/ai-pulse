export function eventDrawerHref(pathname: string, search: string, eventId: number): string {
  void pathname;
  void search;
  return `/events/${eventId}`;
}

export function eventIdFromEventPath(path: string): number | null {
  const match = /^\/events\/(\d+)(?:$|[/?#])/.exec(path.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function eventIdFromSearch(value: string | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
