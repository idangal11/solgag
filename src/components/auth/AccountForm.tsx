'use client';

import { Briefcase, Check, Home, Loader2 } from 'lucide-react';
import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { updateProfile, type ProfileFormState } from '@/app/account/actions';
import { useApp } from '@/components/AppProvider';
import type { Profile, UserRole } from '@/lib/types';

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string; icon: ReactNode }[] = [
  { value: 'owner', label: 'בעלי גג', desc: 'מציעים גג גדול לפרויקט סולארי', icon: <Home size={17} aria-hidden /> },
  { value: 'investor', label: 'משקיע/ה', desc: 'מחפשים גגות להשקעה או להתקנה', icon: <Briefcase size={17} aria-hidden /> },
];

const initialState: ProfileFormState = { status: 'idle' };

export function AccountForm({ profile, welcome, next }: { profile: Profile; welcome: boolean; next: string }) {
  const { toast } = useApp();
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [role, setRole] = useState<UserRole>(profile.role);
  const errors = state.status === 'error' ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state.status === 'ok') toast(state.message ?? 'הפרטים נשמרו');
  }, [state, toast]);

  return (
    <form action={formAction} className="account-form" noValidate>
      {welcome && (
        <>
          <input type="hidden" name="welcome" value="1" />
          <input type="hidden" name="next" value={next} />
        </>
      )}

      <label className="field">
        <span>שם מלא</span>
        <input
          name="fullName"
          autoComplete="name"
          maxLength={100}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoFocus={welcome}
          required
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={errors.fullName ? 'fullName-err' : undefined}
        />
        {errors.fullName && (
          <small className="err" id="fullName-err">
            {errors.fullName}
          </small>
        )}
      </label>

      <label className="field">
        <span>טלפון (לא חובה)</span>
        <input
          className="ltr-input"
          name="phone"
          type="tel"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          maxLength={30}
          placeholder="050-1234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? 'phone-err' : undefined}
        />
        {errors.phone && (
          <small className="err" id="phone-err">
            {errors.phone}
          </small>
        )}
      </label>

      <fieldset className="role-opts" aria-describedby="role-hint">
        <legend>איך אתם משתמשים בעיקר בסולגג?</legend>
        {ROLE_OPTIONS.map((o) => (
          <label key={o.value} className={`agree-opt${role === o.value ? ' on' : ''}`}>
            <input type="radio" name="role" value={o.value} checked={role === o.value} onChange={() => setRole(o.value)} />
            <b className="role-opt-title">
              {o.icon}
              {o.label}
            </b>
            <small>{o.desc}</small>
          </label>
        ))}
        <p className="hint" id="role-hint">
          משמש להתאמת האזור האישי בלבד. אפשר גם לפרסם גג וגם לפנות למודעות בכל מקרה.
        </p>
        {errors.role && <small className="err">{errors.role}</small>}
      </fieldset>

      <p className="hint">הפרטים בפרופיל גלויים רק לכם ולצוות הפלטפורמה.</p>

      {state.status === 'error' && state.message && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? <Loader2 size={16} className="spin" aria-hidden /> : <Check size={16} aria-hidden />}
          {welcome ? 'שמירה והמשך' : 'שמירת הפרטים'}
        </button>
      </div>
    </form>
  );
}
