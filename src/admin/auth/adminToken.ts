const STORAGE_KEY = 'aipulse_admin_token';

export function getAdminToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string) {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearAdminToken() {
  window.localStorage.removeItem(STORAGE_KEY);
}

