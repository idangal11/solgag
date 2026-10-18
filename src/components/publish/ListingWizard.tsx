'use client';

import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { toListingRow, type ListingRow } from '@/lib/listing-payload';
import { createClient } from '@/lib/supabase/client';
import type { Listing } from '@/lib/types';
import '@/styles/publish.css';
import { AgreementStep } from './AgreementStep';
import { DetailsStep } from './DetailsStep';
import {
  draftFromListing,
  errorsForStep,
  footprintChanged,
  locationChanged,
  newDraft,
  stepOfError,
  STEPS,
  validateDraft,
  type Draft,
} from './draft';
import { ImageUploader } from './ImageUploader';
import { removeListingImages, uploadListingImages, type ExistingImage, type PendingImage } from './images';
import { LocationStep } from './LocationStep';
import { OwnerStep } from './OwnerStep';

interface Props {
  userId: string;
  /** Create mode: prefilled from the profile's full name. */
  defaultOwnerName?: string;
  /** Edit mode: the listing being edited (must be the user's own). */
  listing?: Listing;
  existingImages?: ExistingImage[];
}

const LAST = STEPS.length - 1;

function saveErrorMessage(e: unknown): string {
  const err = (e ?? {}) as { message?: string; code?: string };
  if (err.code === '42501') return 'אין הרשאה לשמור את המודעה. ייתכן שתוקף ההתחברות פג — התחברו מחדש ונסו שוב.';
  if (err.message === 'not-found') return 'המודעה לא נמצאה, או שאין לך הרשאה לערוך אותה.';
  // Domain errors raised by the database triggers are already in Hebrew.
  if (err.message && /[֐-׿]/.test(err.message)) return err.message;
  return 'שמירת המודעה נכשלה. בדקו את החיבור לאינטרנט ונסו שוב.';
}

export function ListingWizard({ userId, defaultOwnerName = '', listing, existingImages = [] }: Props) {
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

  const bodyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const validation = useMemo(() => validateDraft(d), [d]);
  const stepErrors = attempted.has(step) ? errorsForStep(validation.errors, step) : {};

  // The DB trigger resets a verified/pending ownership when the building moves.
  const verificationAtRisk = !!listing && (listing.ownerVerification === 'verified' || listing.ownerVerification === 'pending');
  const geometryEdited = isEdit && (locationChanged(d, initial) || footprintChanged(d, initial));
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

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty || saved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
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

    let listingId: string;
    try {
      if (!listing) {
        const { data: created, error } = await supabase
          .from('listings')
          .insert({ ...row, owner_id: userId })
          .select('id')
          .single();
        if (error) throw error;
        listingId = (created as { id: string }).id;
      } else {
        listingId = listing.id;
        // Re-sending an unchanged geometry could differ in the last decimals and
        // needlessly reset ownership verification, so send only what changed.
        const patch: Partial<ListingRow> = { ...row };
        if (!locationChanged(d, initial)) delete patch.location;
        if (!footprintChanged(d, initial)) delete patch.footprint;
        const { data: updated, error } = await supabase.from('listings').update(patch).eq('id', listingId).select('id');
        if (error) throw error;
        if (!updated?.length) throw new Error('not-found');
      }
    } catch (e) {
      const msg = saveErrorMessage(e);
      setFormError(msg);
      toast(msg, 'error');
      setSaving(false);
      return;
    }

    // The listing is saved at this point; photo problems only produce a warning.
    let imageFailures = 0;
    try {
      const removed = existingImages.filter((img) => !kept.some((k) => k.id === img.id));
      imageFailures += await removeListingImages(supabase, removed);
      const firstSortOrder = kept.length ? Math.max(...kept.map((k) => k.sortOrder)) + 1 : 0;
      imageFailures += await uploadListingImages(supabase, { userId, listingId, images: pending, firstSortOrder });
    } catch {
      imageFailures = Math.max(imageFailures, 1);
    }

    setSaved(true);
    toast(isEdit ? 'השינויים נשמרו' : 'המודעה פורסמה');
    if (imageFailures) {
      toast(
        imageFailures === 1
          ? 'תמונה אחת לא עודכנה. אפשר לנסות שוב מעריכת המודעה.'
          : `${imageFailures} תמונות לא עודכנו. אפשר לנסות שוב מעריכת המודעה.`,
        'error',
      );
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
          {listing
            ? `„${listing.title}״ · השינויים יוצגו במודעה מיד לאחר השמירה.`
            : 'ארבעה שלבים קצרים. המודעה תפורסם באתר מיד לאחר השמירה, ותוכלו לערוך אותה בכל עת.'}
        </p>
      </div>

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

        {step === 0 && <OwnerStep d={d} set={set} errors={stepErrors} />}

        {step === 1 && <LocationStep d={d} set={set} errors={stepErrors} verificationAtRisk={verificationAtRisk} />}

        {step === 2 && (
          <DetailsStep
            d={d}
            set={set}
            errors={stepErrors}
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

        {step === 3 && (
          <AgreementStep d={d} set={set} errors={stepErrors} isEdit={isEdit} resetsVerification={verificationAtRisk && geometryEdited} />
        )}

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
          <Link className="btn ghost" href={cancelHref}>
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
