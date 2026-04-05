/** Backend base URL (no trailing slash). Dev: use Vite proxy so '' works. */
export function apiBase(): string {
  const v = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (v !== undefined && v !== '') return v.replace(/\/$/, '');
  return '';
}
