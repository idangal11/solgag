'use client';

import { Check, ChevronLeft, ChevronRight, Loader2, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from 'react';
import { useApp } from '@/components/AppProvider';
import { toListingRow, type ListingRow } from '@/lib/listing-payload';
import { createClient } from '@/lib/supabase/client';
import type { Listing } from '@/lib/types';
import '@/styles/publish.css';
import { AgreementStep, type TrustStatus } from './AgreementStep';
import { DetailsStep } from './DetailsStep';
import {
  areaChanged,
  draftFromListing,
  errorsForStep,
  footprintChanged,
  locationChanged,
  newDraft,
  ownershipFactsChanged,
  stepOfError,
  STEPS,
  techFactsChanged,
  validateDraft,
  type Draft,
} from './draft';
import { clearStoredWizard, parseStoredWizard, readStoredWizard, storeWizard, wizardStorageKey } from './draftStorage';
import { ImageUploader } from './ImageUploader';
import {
  pruneOrphanFiles,
  removeListingImages,
  uploadListingImages,
  type ExistingImage,
  type ImageResult,
  type PendingImage,
} from './images';
import { LocationStep } from './LocationStep';
import { OwnerStep } from './OwnerStep';
import { saveErrorMessage, saveFailure, type SaveFailure } from './saveErrors';

interface Props {
  userId: string;
  /** Create mode: prefilled from the profile's full name. */
  defaultOwnerName?: string;
  /** Edit mode: the listing being edited (must be the user's own). */
  listing?: Listing;
  existingImages?: ExistingImage[];
}

const LAST = STEPS.length - 1;
/** Stable default, so effects that depend on the photo list do not re-run every render. */
const NO_IMAGES: ExistingImage[] = [];

const noSubscribe = () => () => {};
const serverSnapshot = () => undefined;

/** "…you will need to attach the new photo(s) again" — singular/plural agree in Hebrew. */
const reattachText = (n: number) =>
  n === 1 ? 'את התמונה החדשה יהיה צורך לצרף מחדש' : `את ${n} התמונות החדשות יהיה צורך לצרף מחדש`;
const lostPhotosText = (n: number) =>
  n === 1
    ? `התמונה החדשה שצירפתם לא נשמרה בטיוטה — יש לצרף אותה מחדש בשלב „${STEPS[2]}״.`
    : `${n} התמונות החדשות שצירפתם לא נשמרו בטיוטה — יש לצרף אותן מחדש בשלב „${STEPS[2]}״.`;

export function ListingWizard({ userId, defaultOwnerName = '', listing, existingImages = NO_IMAGES }: Props) {
  const router = useRouter();
  const { toast } = useApp();
  const isEdit = !!listing;

  const [initial] = useState<Draft>(() => (listing ? draftFromListing(listing) : newDraft(defaultOwnerName)));
  const [d, setD] = useState<Draft>(initial);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(isEdit ? LAST : 0);
  const [attempted, setAttempted] = useState<ReadonlySet<number>>(() => new Set());
  const [kept, setKept] = useState<ExistingImage[]>(existingImages);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');
  const [focusReq, setFocusReq] = useState<{ kind: 'heading' | 'error'; n: number } | null>(null);
  const [restored, setRestored] = useState<{ lostPhotos: number } | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // ─── Unsaved draft kept in sessionStorage (Back button, reloads, iOS) ──────
  const storageKey = wizardStorageKey(userId, listing?.id);
  // A draft of an older version of the listing would overwrite newer changes.
  const baseVersion = listing ? listing.updatedAt : 'new';
  const [restoreChecked, setRestoreChecked] = useState(false);
  // The server render and hydration see `undefined` (no storage there); the client
  // snapshot right after hydration (or on a client-side visit) holds the saved draft.
  const storedRaw = useSyncExternalStore<string | null | undefined>(
    noSubscribe,
    () => (restoreChecked ? null : readStoredWizard(storageKey)),
    serverSnapshot,
  );
  if (!restoreChecked && storedRaw !== undefined) {
    // Adjusting state during render (React's pattern for derived state): runs once.
    setRestoreChecked(true);
    const snap = parseStoredWizard(storedRaw, { base: initial, baseVersion, lastStep: LAST });
    if (snap) {
      setD(snap.draft);
      setMaxStep(isEdit ? LAST : snap.maxStep);
      setStep(snap.step);
      if (snap.removedIds.length) {
        const removed = new Set(snap.removedIds);
        setKept(existingImages.filter((img) => !removed.has(img.id)));
      }
      setRestored({ lostPhotos: snap.lostPhotos });
    }
  }
  /** Set once the listing is saved or the draft discarded: nothing may be stored after that. */
  const stopPersisting = useRef(false);
  const persisted = useRef(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const validation = useMemo(() => validateDraft(d), [d]);
  const stepErrors = attempted.has(step) ? errorsForStep(validation.errors, step) : {};

  // The DB guard resets a verified/pending ownership when the building, its locality
  // or the publisher name changes, and downgrades a technical survey when the
  // location, outline, area or roof data change. Tell the owner before saving.
  const verificationAtRisk = !!listing && (listing.ownerVerification === 'verified' || listing.ownerVerification === 'pending');
  const surveyAtRisk =
    listing && (listing.techAssessment === 'assessed' || listing.techAssessment === 'survey_planned') ? listing.techAssessment : null;
  const trust: TrustStatus | null = listing
    ? {
        ownerBefore: listing.ownerVerification,
        ownerAfter: verificationAtRisk && ownershipFactsChanged(d, initial) ? 'not_verified' : listing.ownerVerification,
        techBefore: listing.techAssessment,
        techAfter: surveyAtRisk && techFactsChanged(d, initial) ? 'owner_reported' : listing.techAssessment,
      }
    : null;
  const dirty = d !== initial || pending.length > 0 || kept.length !== existingImages.length;

  // Focus the step heading after navigation, or the first invalid field after a failed attempt.
  useEffect(() => {
    if (!focusReq) return;
    if (focusReq.kind === 'heading') {
      headingRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], .err');
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusReq]);

  // Keep the draft in this tab while it has unsaved changes.
  useEffect(() => {
    // Skipped until the stored draft was read, or hydration would erase it.
    if (!restoreChecked || saved || stopPersisting.current) return;
    if (!dirty) {
      clearStoredWizard(storageKey);
      persisted.current = false;
      return;
    }
    persisted.current = storeWizard(storageKey, baseVersion, {
      draft: d,
      step,
      maxStep,
      removedIds: existingImages.filter((img) => !kept.some((k) => k.id === img.id)).map((img) => img.id),
      pendingPhotos: pending.length,
    });
  }, [restoreChecked, saved, dirty, d, step, maxStep, kept, existingImages, pending.length, storageKey, baseVersion]);

  // Warn before leaving the page with unsaved changes: reloads and closing the tab...
  useEffect(() => {
    if (!dirty || saved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, saved]);

  // ...and in-app links (header, bottom nav, footer), which `beforeunload` never sees.
  // Capture phase on document runs before React's handlers on the root, so a
  // declined confirm stops next/link from navigating at all.
  useEffect(() => {
    if (!dirty || saved) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!(a instanceof HTMLAnchorElement) || a.hasAttribute('download') || a.dataset.leaveGuard === 'off') return;
      if (a.target && a.target !== '_self') return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // a full page load: beforeunload asks
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // #anchors, skip link
      const photos = pendingRef.current.length;
      const outcome = persisted.current
        ? `\nהטיוטה תישמר בלשונית זו ותשוחזר כשתחזרו לעמוד${photos ? `, אבל ${reattachText(photos)}` : ''}.`
        : '\nהשינויים יאבדו.';
      if (window.confirm(`יש שינויים שלא נשמרו במודעה. לצאת מהעמוד בלי לשמור?${outcome}`)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty, saved]);

  // Free the local previews of photos that were never uploaded.
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const goTo = (s: number) => {
    setStep(s);
    setMaxStep((m) => Math.max(m, s));
    setFocusReq((r) => ({ kind: 'heading', n: (r?.n ?? 0) + 1 }));
  };

  const showErrorsOn = (s: number) => {
    setAttempted((prev) => new Set(prev).add(s));
    setFocusReq((r) => ({ kind: 'error', n: (r?.n ?? 0) + 1 }));
  };

  const next = () => {
    if (Object.keys(errorsForStep(validation.errors, step)).length) {
      showErrorsOn(step);
      return;
    }
    goTo(step + 1);
  };

  const removePending = (key: string) =>
    setPending((list) => {
      const img = list.find((p) => p.key === key);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return list.filter((p) => p.key !== key);
    });

  /** "Start over" on a restored draft: back to the saved listing (or an empty form). */
  const discardDraft = () => {
    const question = isEdit ? 'למחוק את הטיוטה ולחזור לפרטים השמורים של המודעה?' : 'למחוק את הטיוטה ולהתחיל מחדש?';
    if (!window.confirm(question)) return;
    clearStoredWizard(storageKey);
    pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
    setD(initial);
    setKept(existingImages);
    setAttempted(new Set());
    setFormError('');
    setRestored(null);
    setMaxStep(isEdit ? LAST : 0);
    goTo(0);
  };

  const onCancel = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!dirty || saved) return;
    const question = isEdit ? 'לבטל את העריכה? השינויים שלא נשמרו יימחקו.' : 'לבטל את הפרסום? הפרטים שמילאתם יימחקו.';
    if (!window.confirm(question)) {
      e.preventDefault();
      return;
    }
    stopPersisting.current = true;
    clearStoredWizard(storageKey);
  };

  const submit = async () => {
    if (saving) return;
    const { data, errors } = validateDraft(d);
    if (!data) {
      const first = Math.min(...Object.keys(errors).map(stepOfError));
      setStep(first);
      showErrorsOn(first);
      toast('יש להשלים או לתקן את השדות המסומנים', 'error');
      return;
    }

    setSaving(true);
    setFormError('');
    const supabase = createClient();
    const row = toListingRow(data);

    const save = async (): Promise<{ id: string } | { failure: SaveFailure }> => {
      try {
        if (!listing) {
          const { data: created, error, status } = await supabase
            .from('listings')
            .insert({ ...row, owner_id: userId })
            .select('id')
            .single();
          if (error) return { failure: saveFailure(error, status) };
          return { id: (created as { id: string }).id };
        }
        // Send only what changed: re-sending an unchanged geometry could differ in
        // the last decimals, and a recomputed usable area could differ by rounding —
        // either would needlessly reset the ownership/technical badges.
        const patch: Partial<ListingRow> = { ...row };
        if (!locationChanged(d, initial)) delete patch.location;
        if (!footprintChanged(d, initial)) delete patch.footprint;
        if (!areaChanged(d, initial)) delete patch.usable_area_sqm;
        const { data: updated, error, status } = await supabase.from('listings').update(patch).eq('id', listing.id).select('id');
        if (error) return { failure: saveFailure(error, status) };
        if (!updated?.length) return { failure: { message: 'not-found' } };
        return { id: listing.id };
      } catch {
        return { failure: { status: 0 } }; // network failure, aborted request
      }
    };

    const result = await save();
    if ('failure' in result) {
      const msg = saveErrorMessage(result.failure);
      setFormError(msg);
      toast(msg, 'error');
      setSaving(false);
      return;
    }
    const listingId = result.id;

    // The listing is saved: the stored draft is obsolete even if a photo fails below.
    stopPersisting.current = true;
    clearStoredWizard(storageKey);

    // Photo problems only produce a warning.
    const images: ImageResult = { failed: 0 };
    const add = (r: ImageResult) => {
      images.failed += r.failed;
      images.reason ??= r.reason;
    };
    try {
      const removed = existingImages.filter((img) => !kept.some((k) => k.id === img.id));
      add(await removeListingImages(supabase, removed));
      if (isEdit && pending.length) await pruneOrphanFiles(supabase, { userId, listingId }).catch(() => undefined);
      const firstSortOrder = kept.length ? Math.max(...kept.map((k) => k.sortOrder)) + 1 : 0;
      add(await uploadListingImages(supabase, { userId, listingId, images: pending, firstSortOrder }));
    } catch {
      images.failed = Math.max(images.failed, 1);
      images.reason ??= 'בעיית חיבור לשרת התמונות.';
    }

    setSaved(true);
    toast(isEdit ? 'השינויים נשמרו' : 'המודעה פורסמה');
    if (images.failed) {
      const count = images.failed === 1 ? 'תמונה אחת לא עודכנה' : `${images.failed} תמונות לא עודכנו`;
      toast(`${count}: ${images.reason ?? 'שגיאה לא צפויה.'} אפשר לנסות שוב מעריכת המודעה.`, 'error');
    }
    router.push(`/listing/${listingId}`);
    router.refresh();
  };

  const cancelHref = listing ? `/listing/${listing.id}` : '/';

  return (
    <div className="page publish-page">
      <div className="publish-head">
        <h1>{listing ? 'עריכת מודעה' : 'פרסום גג'}</h1>
        <p className="muted">
          {!listing
            ? 'ארבעה שלבים קצרים. המודעה תפורסם באתר מיד לאחר השמירה, ותוכלו לערוך אותה בכל עת.'
            : listing.adminHidden
              ? `„${listing.title}״ · המודעה הוסתרה על ידי צוות האתר ואינה מוצגת לציבור. השינויים יישמרו, אך המודעה תישאר מוסתרת.`
              : listing.status === 'hidden'
                ? `„${listing.title}״ · המודעה מוסתרת כרגע. השינויים יישמרו, ויוצגו לאחר שתפרסמו אותה מחדש מהאזור האישי.`
                : `„${listing.title}״ · השינויים יוצגו במודעה מיד לאחר השמירה.`}
        </p>
      </div>

      {restored && (
        <div className="note info-note restore-note" role="status">
          <RotateCcw size={15} aria-hidden />
          <span className="restore-text">
            שחזרנו את הטיוטה שלא נשמרה.
            {restored.lostPhotos > 0 && ` ${lostPhotosText(restored.lostPhotos)}`}
          </span>
          <span className="restore-actions">
            <button type="button" className="btn ghost sm" onClick={discardDraft}>
              מחיקת הטיוטה
            </button>
            <button type="button" className="icon-btn" aria-label="סגירת ההודעה" onClick={() => setRestored(null)}>
              <X size={14} aria-hidden />
            </button>
          </span>
        </div>
      )}

      <ol className="stepper" aria-label={isEdit ? 'שלבי העריכה' : 'שלבי הפרסום'}>
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''}>
            <button
              type="button"
              onClick={() => i !== step && goTo(i)}
              disabled={i > maxStep}
              aria-current={i === step ? 'step' : undefined}
              aria-label={`שלב ${i + 1}: ${s}`}
            >
              <span className="num">{i < step ? <Check size={14} /> : i + 1}</span>
              <span className="lbl">{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="card-surface step-body" ref={bodyRef} key={step}>
        <h2 className="step-title" ref={headingRef} tabIndex={-1}>
          שלב {step + 1} מתוך {STEPS.length}: {STEPS[step]}
        </h2>

        {step === 0 && <OwnerStep d={d} set={set} errors={stepErrors} verificationAtRisk={verificationAtRisk} />}

        {step === 1 && <LocationStep d={d} set={set} errors={stepErrors} verificationAtRisk={verificationAtRisk} />}

        {step === 2 && (
          <DetailsStep
            d={d}
            set={set}
            errors={stepErrors}
            surveyAtRisk={surveyAtRisk}
            images={
              <ImageUploader
                existing={kept}
                pending={pending}
                onAdd={(imgs) => setPending((list) => [...list, ...imgs])}
                onRemoveExisting={(id) => setKept((list) => list.filter((k) => k.id !== id))}
                onRemovePending={removePending}
              />
            }
          />
        )}

        {step === 3 && <AgreementStep d={d} set={set} errors={stepErrors} status={trust} />}

        {formError && step === LAST && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
      </div>

      <div className="wizard-nav">
        {step > 0 ? (
          <button type="button" className="btn ghost" onClick={() => goTo(step - 1)} disabled={saving}>
            <ChevronRight size={16} /> הקודם
          </button>
        ) : (
          <Link className="btn ghost" href={cancelHref} data-leave-guard="off" onClick={onCancel}>
            ביטול
          </Link>
        )}
        {step < LAST ? (
          <button type="button" className="btn primary" onClick={next}>
            הבא <ChevronLeft size={16} />
          </button>
        ) : (
          <button type="button" className="btn accent" onClick={submit} disabled={saving} aria-busy={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
            {saving ? 'שומר…' : isEdit ? 'שמירת השינויים' : 'פרסום המודעה'}
          </button>
        )}
      </div>
    </div>
  );
}
