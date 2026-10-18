'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

type ToastTone = 'success' | 'info' | 'error';
interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

export interface SessionUser {
  id: string;
  displayName: string;
  isAdmin: boolean;
}

interface AppContextValue {
  user: SessionUser | null;
  favorites: ReadonlySet<string>;
  toggleFavorite: (listingId: string) => Promise<void>;
  toast: (text: string, tone?: ToastTone) => void;
  /** Sends anonymous users to /login and returns false; true when signed in. */
  requireAuth: (reason?: string) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  user,
  initialFavorites,
  children,
}: {
  user: SessionUser | null;
  initialFavorites: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(initialFavorites));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pending = useRef(new Set<string>());

  const toast = useCallback((text: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const requireAuth = useCallback(
    (reason?: string) => {
      if (user) return true;
      if (reason) toast(reason, 'info');
      router.push(`/login?next=${encodeURIComponent(pathname || '/')}`);
      return false;
    },
    [user, router, pathname, toast],
  );

  const toggleFavorite = useCallback(
    async (listingId: string) => {
      if (!requireAuth('כדי לשמור מועדפים יש להתחבר')) return;
      if (pending.current.has(listingId)) return;
      pending.current.add(listingId);
      const wasFav = favorites.has(listingId);
      const flip = (on: boolean) =>
        setFavorites((prev) => {
          const next = new Set(prev);
          if (on) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
      flip(!wasFav); // optimistic
      const supabase = createClient();
      const { error } = wasFav
        ? await supabase.from('favorites').delete().eq('user_id', user!.id).eq('listing_id', listingId)
        : await supabase.from('favorites').insert({ user_id: user!.id, listing_id: listingId });
      pending.current.delete(listingId);
      if (error && error.code !== '23505') {
        flip(wasFav);
        toast('לא הצלחנו לעדכן את המועדפים. נסו שוב.', 'error');
        return;
      }
      toast(wasFav ? 'הוסר מהמועדפים' : 'נשמר במועדפים', 'info');
      // The heart state is already updated optimistically. Refresh server data only
      // where it matters (e.g. the dashboard favorites list) — not on the map page,
      // where a refresh would refetch every listing.
      if (pathname !== '/') router.refresh();
    },
    [favorites, requireAuth, toast, user, router, pathname],
  );

  const value = useMemo<AppContextValue>(
    () => ({ user, favorites, toggleFavorite, toast, requireAuth }),
    [user, favorites, toggleFavorite, toast, requireAuth],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.tone === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
            {t.text}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
