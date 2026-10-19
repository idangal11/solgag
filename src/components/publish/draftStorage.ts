import { AGREEMENT_LABEL, AVAILABILITY, BUILDING_LABEL, REGION_LABEL } from '@/lib/labels';
import type { LatLng } from '@/lib/types';
import { MAX_VERTICES, USABLE_PCT, type Draft } from './draft';

// The unsaved wizard state is kept in this tab's sessionStorage, so the browser's
// Back button, an accidental in-app link, a reload or an iOS tab discard (where
// `beforeunload` never fires) do not lose the owner's work. A per-viewer
// convenience only: every access is guarded and the wizard works without it.
// Picked photos (Blobs) cannot be stored; only how many were lost is kept.

const VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface WizardSnapshot {
  draft: Draft;
  step: number;
  maxStep: number;
  /**
   * Edit mode: ids of stored photos the owner removed in this draft. Removals, not
   * the kept list, so a photo added elsewhere since then is never deleted by a restore.
   */
  removedIds: string[];
  /** Newly picked photos that could not be stored with the draft. */
  lostPhotos: number;
}

interface Envelope {
  v: number;
  /** 'new', or the listing's updated_at: a draft of an older version is dropped. */
  base: string;
  savedAt: number;
  draft: unknown;
  step: unknown;
  maxStep: unknown;
  removedIds: unknown;
  pendingPhotos: unknown;
}

export const wizardStorageKey = (userId: string, listingId?: string) => `solgag:publish-draft:${userId}:${listingId ?? 'new'}`;

export function readStoredWizard(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns false when the browser refused to store it (private mode, quota, blocked). */
export function storeWizard(
  key: string,
  base: string,
  s: { draft: Draft; step: number; maxStep: number; removedIds: string[]; pendingPhotos: number },
): boolean {
  const env: Envelope = { v: VERSION, base, savedAt: Date.now(), ...s };
  try {
    window.sessionStorage.setItem(key, JSON.stringify(env));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredWizard(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

const ENUMS: Partial<Record<keyof Draft, readonly string[]>> = {
  buildingType: Object.keys(BUILDING_LABEL),
  region: Object.keys(REGION_LABEL),
  agreement: Object.keys(AGREEMENT_LABEL),
  availability: Object.keys(AVAILABILITY),
  areaMode: ['polygon', 'manual'],
  manualSource: ['manual_measured', 'manual_estimate'],
};

const isLatLng = (v: unknown): v is LatLng =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

/** Field-by-field merge onto `base`: anything malformed keeps the base value. */
function sanitizeDraft(raw: unknown, base: Draft): Draft | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const out = { ...base } as Record<keyof Draft, unknown>;
  for (const k of Object.keys(base) as (keyof Draft)[]) {
    const v = src[k];
    if (v === undefined) continue;
    if (k === 'location') {
      if (v === null || isLatLng(v)) out.location = v;
    } else if (k === 'polygon') {
      if (Array.isArray(v) && v.length <= MAX_VERTICES && v.every(isLatLng)) out.polygon = v;
    } else if (k === 'usablePct') {
      if (typeof v === 'number' && Number.isFinite(v)) out.usablePct = Math.min(USABLE_PCT.max, Math.max(USABLE_PCT.min, Math.round(v)));
    } else if (k === 'declared') {
      // The declaration is always confirmed again, right before saving.
    } else if (typeof v === 'string' && typeof base[k] === 'string') {
      const allowed = ENUMS[k];
      if (!allowed || allowed.includes(v)) out[k] = v.slice(0, 5000);
    }
  }
  return out as unknown as Draft;
}

const intIn = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Parses what storeWizard wrote; null when absent, stale, from another version or malformed. */
export function parseStoredWizard(
  raw: string | null,
  { base, baseVersion, lastStep }: { base: Draft; baseVersion: string; lastStep: number },
): WizardSnapshot | null {
  if (!raw) return null;
  let env: Partial<Envelope>;
  try {
    env = JSON.parse(raw) as Partial<Envelope>;
  } catch {
    return null;
  }
  if (!env || env.v !== VERSION || env.base !== baseVersion) return null;
  if (typeof env.savedAt !== 'number' || Date.now() - env.savedAt > MAX_AGE_MS) return null;
  const draft = sanitizeDraft(env.draft, base);
  if (!draft) return null;
  const maxStep = intIn(env.maxStep, 0, lastStep, 0);
  return {
    draft,
    maxStep,
    step: intIn(env.step, 0, maxStep, 0),
    removedIds: Array.isArray(env.removedIds) ? env.removedIds.filter((id): id is string => typeof id === 'string') : [],
    lostPhotos: intIn(env.pendingPhotos, 0, 100, 0),
  };
}
