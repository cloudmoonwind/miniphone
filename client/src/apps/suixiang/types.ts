export interface Card {
  id: string;
  title: string;
  color: string;
  pinned: boolean;
  entryCount: number;
  latestEntry?: { content: string };
  updatedAt?: string;
}

export interface Entry {
  id: string;
  content: string;
  mood?: string | null;
  createdAt: string;
}

export const api = (path: string, opts: RequestInit = {}) =>
  fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  }).then(r => r.json());
