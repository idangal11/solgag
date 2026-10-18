import { useEffect, useState } from 'react';

export type Route =
  | { name: 'explore'; focus?: string }
  | { name: 'listing'; id: string }
  | { name: 'publish' }
  | { name: 'calculator' }
  | { name: 'dashboard' };

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  switch (parts[0]) {
    case 'listing':
      return parts[1] ? { name: 'listing', id: decodeURIComponent(parts[1]) } : { name: 'explore' };
    case 'publish':
      return { name: 'publish' };
    case 'calculator':
      return { name: 'calculator' };
    case 'dashboard':
      return { name: 'dashboard' };
    default:
      return { name: 'explore', focus: params.get('focus') ?? undefined };
  }
}

export const href = {
  explore: (focus?: string) => (focus ? `#/?focus=${encodeURIComponent(focus)}` : '#/'),
  listing: (id: string) => `#/listing/${encodeURIComponent(id)}`,
  publish: () => '#/publish',
  calculator: () => '#/calculator',
  dashboard: () => '#/dashboard',
};

export function navigate(to: string) {
  window.location.hash = to.replace(/^#/, '');
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
