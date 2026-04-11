// Base fetch wrapper – all API calls go through here.
// The Vite dev proxy forwards /api → http://localhost:3000
const BASE = '';

async function request(method: string, path: string, body?: unknown): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  get:    (path: string)               => request('GET',    path),
  post:   (path: string, body?: unknown) => request('POST',   path, body),
  put:    (path: string, body?: unknown) => request('PUT',    path, body),
  delete: (path: string)               => request('DELETE', path),
};
