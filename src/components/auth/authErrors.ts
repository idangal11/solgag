import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

export interface AuthErrorInfo {
  message: string;
  /** Seconds until another code may be requested, when the server said so. */
  retryAfter?: number;
}

/** Hebrew message for a Supabase Auth error from signInWithOtp / verifyOtp. */
export function authErrorInfo(error: unknown, step: 'send' | 'verify'): AuthErrorInfo {
  if (isAuthRetryableFetchError(error)) {
    return { message: 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.' };
  }
  if (!isAuthError(error)) return { message: 'משהו השתבש. נסו שוב בעוד רגע.' };

  const wait = /(\d+)\s*seconds?/i.exec(error.message);
  const retryAfter = wait ? Number(wait[1]) : undefined;

  switch (error.code) {
    case 'otp_expired':
      return { message: 'הקוד שגוי או שפג תוקפו. בדקו את הקוד, או בקשו קוד חדש.' };
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
    case 'over_request_rate_limit':
      return {
        message: retryAfter
          ? `מטעמי אבטחה אפשר לבקש קוד חדש בעוד ${retryAfter} שניות.`
          : 'נשלחו יותר מדי בקשות. נסו שוב בעוד כמה דקות.',
        retryAfter,
      };
    case 'email_address_invalid':
      return { message: 'כתובת הדוא״ל אינה תקינה.' };
    case 'email_address_not_authorized':
      return { message: 'לא ניתן לשלוח כרגע דוא״ל לכתובת זו. נסו כתובת אחרת או פנו אלינו.' };
    case 'signup_disabled':
      return { message: 'פתיחת חשבונות חדשים בשיטה זו אינה זמינה כרגע.' };
    case 'otp_disabled':
    case 'email_provider_disabled':
    case 'phone_provider_disabled':
    case 'provider_disabled':
      return { message: 'שיטת הכניסה הזו אינה זמינה כרגע.' };
    case 'sms_send_failed':
      return { message: 'לא הצלחנו לשלוח SMS למספר הזה. בדקו את המספר או היכנסו עם דוא״ל.' };
    case 'user_banned':
      return { message: 'החשבון חסום. לפרטים פנו לצוות הפלטפורמה.' };
    case 'captcha_failed':
      return { message: 'אימות האבטחה נכשל. רעננו את הדף ונסו שוב.' };
    case 'validation_failed':
      return { message: step === 'send' ? 'הפרטים שהוזנו אינם תקינים.' : 'הקוד אינו תקין.' };
  }

  if (error.status === 429) {
    return { message: 'נשלחו יותר מדי בקשות. נסו שוב בעוד כמה דקות.', retryAfter };
  }
  if (step === 'verify' && (error.status === 400 || error.status === 403)) {
    return { message: 'הקוד שגוי או שפג תוקפו. בדקו את הקוד, או בקשו קוד חדש.' };
  }
  return { message: step === 'send' ? 'לא הצלחנו לשלוח את הקוד. נסו שוב בעוד רגע.' : 'הכניסה נכשלה. נסו שוב.' };
}
