'use client';

import { ChevronRight, KeyRound, Loader2, LogIn, Mail, Smartphone, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useApp } from '@/components/AppProvider';
import { Logo } from '@/components/Logo';
import { createClient } from '@/lib/supabase/client';
import { authErrorInfo } from './authErrors';
import { welcomePath } from './paths';
import { toE164 } from './phone';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ERROR_ID = 'login-error';

type Method = 'email' | 'phone';
type Stage = 'request' | 'verify' | 'done';

export function LoginForm({ next, phoneEnabled, linkError }: { next: string; phoneEnabled: boolean; linkError: boolean }) {
  const router = useRouter();
  const { toast } = useApp();
  const [method, setMethod] = useState<Method>('email');
  const [stage, setStage] = useState<Stage>('request');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [target, setTarget] = useState(''); // normalised email / E.164 phone the code was sent to
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError ? 'הקישור שנפתח אינו תקף או שפג תוקפו. אפשר לבקש כאן קוד כניסה חדש.' : null,
  );
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(to: string, via: Method): Promise<boolean> {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } =
      via === 'email'
        ? await supabase.auth.signInWithOtp({
            email: to,
            options: {
              shouldCreateUser: true,
              // Only used if the email template also contains a sign-in link.
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
          })
        : await supabase.auth.signInWithOtp({ phone: to, options: { shouldCreateUser: true } });
    setPending(false);
    if (error) {
      const info = authErrorInfo(error, 'send');
      setError(info.message);
      if (info.retryAfter) setCooldown(info.retryAfter);
      return false;
    }
    setCooldown(RESEND_SECONDS);
    return true;
  }

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const to = method === 'email' ? email.trim().toLowerCase() : toE164(phone);
    if (method === 'email' && !EMAIL_RE.test(to ?? '')) {
      setError('נא להזין כתובת דוא״ל תקינה.');
      return;
    }
    if (!to) {
      setError('נא להזין מספר נייד תקין, למשל 050-1234567.');
      return;
    }
    if (to === target && cooldown > 0) {
      // Same address again within the cooldown: the code we just sent is still valid.
      setError(null);
      setStage('verify');
      return;
    }
    if (await sendCode(to, method)) {
      setTarget(to);
      setCode('');
      setStage('verify');
    }
  }

  async function verify(token: string) {
    if (pending || stage !== 'verify') return;
    if (token.length !== CODE_LENGTH) {
      setError(`נא להזין את ${CODE_LENGTH} הספרות שקיבלתם.`);
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data, error } =
      method === 'email'
        ? await supabase.auth.verifyOtp({ email: target, token, type: 'email' })
        : await supabase.auth.verifyOtp({ phone: target, token, type: 'sms' });
    if (error || !data.user) {
      setPending(false);
      setError(authErrorInfo(error, 'verify').message);
      setCode('');
      codeRef.current?.focus();
      return;
    }
    setStage('done');
    // Accounts without a name (e.g. brand-new ones) pass through a short onboarding step first.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', data.user.id)
      .maybeSingle();
    const needsName = !profileError && profile !== null && !String(profile.full_name ?? '').trim();
    router.replace(needsName ? welcomePath(next) : next);
    router.refresh();
  }

  async function onResend() {
    if (pending || cooldown > 0) return;
    if (await sendCode(target, method)) {
      setCode('');
      toast('שלחנו קוד חדש. הקוד הקודם כבר אינו בתוקף.', 'info');
      codeRef.current?.focus();
    }
  }

  function onCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === CODE_LENGTH) void verify(digits);
  }

  function backToRequest() {
    setStage('request');
    setError(null);
    setCode('');
  }

  function switchMethod(m: Method) {
    setMethod(m);
    setError(null);
  }

  const invalidProps = error ? { 'aria-invalid': true, 'aria-describedby': ERROR_ID } : {};
  const errorBox = error && (
    <p className="form-error" id={ERROR_ID} role="alert">
      {error}
    </p>
  );

  return (
    <div className="auth-card">
      <div className="auth-head">
        <Logo size={44} />
        <h1>{stage === 'request' ? 'כניסה לסולגג' : 'הזנת קוד כניסה'}</h1>
        {stage === 'request' && <p className="muted">כניסה והרשמה באותו מקום, בלי סיסמה.</p>}
      </div>

      {stage === 'request' ? (
        <form onSubmit={onRequest} noValidate className="auth-form">
          {phoneEnabled && (
            <div className="seg auth-method" role="radiogroup" aria-label="שיטת כניסה">
              <button type="button" role="radio" aria-checked={method === 'email'} className={method === 'email' ? 'on' : ''} onClick={() => switchMethod('email')}>
                <Mail size={16} aria-hidden /> דוא״ל
              </button>
              <button type="button" role="radio" aria-checked={method === 'phone'} className={method === 'phone' ? 'on' : ''} onClick={() => switchMethod('phone')}>
                <Smartphone size={16} aria-hidden /> טלפון נייד
              </button>
            </div>
          )}

          {method === 'email' ? (
            <label className="field">
              <span>כתובת דוא״ל</span>
              <input
                className="ltr-input"
                type="email"
                name="email"
                dir="ltr"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
                {...invalidProps}
              />
            </label>
          ) : (
            <label className="field">
              <span>מספר טלפון נייד</span>
              <input
                className="ltr-input"
                type="tel"
                name="phone"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                placeholder="050-1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
                required
                {...invalidProps}
              />
              <small className="hint">נשלח אליכם SMS עם קוד. מספר ישראלי (05X) או בפורמט בינלאומי (+…).</small>
            </label>
          )}

          {errorBox}

          <button type="submit" className="btn primary lg block" disabled={pending}>
            {pending ? <Loader2 size={18} className="spin" aria-hidden /> : <KeyRound size={18} aria-hidden />}
            {pending ? 'שולחים…' : 'שליחת קוד כניסה'}
          </button>

          <ul className="auth-perks">
            <li>
              <KeyRound size={16} aria-hidden />
              <span>אין סיסמה לזכור: בכל כניסה נשלח אליכם קוד חד־פעמי בן {CODE_LENGTH} ספרות.</span>
            </li>
            <li>
              <UserPlus size={16} aria-hidden />
              <span>פעם ראשונה כאן? החשבון נפתח אוטומטית עם הזנת הקוד.</span>
            </li>
          </ul>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
          noValidate
          className="auth-form"
        >
          <p className="auth-sent">
            שלחנו קוד בן {CODE_LENGTH} ספרות אל{' '}
            <bdi dir="ltr" className="auth-target">
              {target}
            </bdi>
            . הקוד תקף לזמן מוגבל.
          </p>

          <label className="field">
            <span>קוד כניסה</span>
            <input
              ref={codeRef}
              className="otp-input"
              name="code"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH}
              placeholder={'•'.repeat(CODE_LENGTH)}
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              readOnly={stage === 'done'}
              autoFocus
              required
              {...invalidProps}
            />
          </label>

          {errorBox}

          <button type="submit" className="btn primary lg block" disabled={pending || stage === 'done' || code.length !== CODE_LENGTH}>
            {pending || stage === 'done' ? <Loader2 size={18} className="spin" aria-hidden /> : <LogIn size={18} aria-hidden />}
            {stage === 'done' ? 'מתחברים…' : pending ? 'בודקים…' : 'כניסה'}
          </button>

          <div className="auth-row">
            <button type="button" className="btn link" onClick={backToRequest} disabled={stage === 'done'}>
              <ChevronRight size={16} aria-hidden />
              {method === 'email' ? 'שינוי כתובת' : 'שינוי מספר'}
            </button>
            <button type="button" className="btn link" onClick={onResend} disabled={pending || cooldown > 0 || stage === 'done'}>
              {cooldown > 0 ? `שליחה חוזרת בעוד ${cooldown} שניות` : 'שליחת קוד חדש'}
            </button>
          </div>
          {method === 'email' && <p className="hint">לא הגיע? בדקו גם בתיקיית הספאם או קידומי מכירות.</p>}
        </form>
      )}

      <p className="auth-legal">
        בכניסה לסולגג אתם מסכימים ל<Link href="/terms">תנאי השימוש</Link> ול<Link href="/privacy">מדיניות הפרטיות</Link>.
      </p>
    </div>
  );
}
