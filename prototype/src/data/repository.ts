import type { DemoRole, Inquiry, Listing } from '../types';
import { buildSeedListings } from './seed';

/**
 * Demo persistence. Every read/write goes through this module so it can be
 * swapped for API calls later without touching the UI.
 */

const KEY = {
  listings: 'solgag.v1.listings',
  favorites: 'solgag.v1.favorites',
  inquiries: 'solgag.v1.inquiries',
  role: 'solgag.v1.role',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Returns false when storage is full or unavailable. */
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const repository = {
  loadListings(): Listing[] {
    const stored = read<Listing[] | null>(KEY.listings, null);
    if (stored && Array.isArray(stored)) return stored;
    const seed = buildSeedListings();
    write(KEY.listings, seed);
    return seed;
  },
  saveListings(listings: Listing[]): boolean {
    return write(KEY.listings, listings);
  },
  loadFavorites(): string[] {
    return read<string[]>(KEY.favorites, []);
  },
  saveFavorites(ids: string[]) {
    write(KEY.favorites, ids);
  },
  loadInquiries(): Inquiry[] {
    return read<Inquiry[]>(KEY.inquiries, []);
  },
  saveInquiries(items: Inquiry[]) {
    return write(KEY.inquiries, items);
  },
  loadRole(): DemoRole {
    return read<DemoRole>(KEY.role, 'investor');
  },
  saveRole(role: DemoRole) {
    write(KEY.role, role);
  },
  reset() {
    Object.values(KEY).forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  },
};

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
