// Client API — JWT en localStorage, fetch wrapper.
const TOKEN_KEY = 'itsm_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export function decodeJwt(token = getToken()) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

export async function api(path, opts = {}) {
  const r = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401) { clearToken(); location.reload(); return; }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
  return data;
}
