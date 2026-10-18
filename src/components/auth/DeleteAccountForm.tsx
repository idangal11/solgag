'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useActionState, useState } from 'react';
import { deleteAccount, type DeleteAccountState } from '@/app/account/actions';

const CONFIRMATION = 'מחיקה';
const initialState: DeleteAccountState = {};

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const [confirm, setConfirm] = useState('');
  const ready = confirm.trim() === CONFIRMATION;

  return (
    <form action={formAction} className="account-form" noValidate>
      <label className="field">
        <span>
          לאישור, הקלידו <b className="confirm-word">{CONFIRMATION}</b>
        </span>
        <input
          name="confirm"
          autoComplete="off"
          spellCheck={false}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? 'delete-err' : undefined}
        />
      </label>

      {state.error && (
        <p className="form-error" id="delete-err" role="alert">
          {state.error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn danger" disabled={!ready || pending}>
          {pending ? <Loader2 size={16} className="spin" aria-hidden /> : <Trash2 size={16} aria-hidden />}
          {pending ? 'מוחקים…' : 'מחיקת החשבון לצמיתות'}
        </button>
      </div>
    </form>
  );
}
