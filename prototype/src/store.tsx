import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { newId, repository } from './data/repository';
import type { DemoRole, Inquiry, Listing } from './types';

interface Toast {
  id: number;
  text: string;
  tone: 'success' | 'info' | 'error';
}

interface Store {
  listings: Listing[];
  favorites: string[];
  inquiries: Inquiry[];
  role: DemoRole;
  toasts: Toast[];
  getListing: (id: string) => Listing | undefined;
  addListing: (l: Listing) => boolean;
  deleteListing: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addInquiry: (i: Omit<Inquiry, 'id' | 'createdAt'>) => Inquiry;
  setRole: (r: DemoRole) => void;
  resetDemo: () => void;
  toast: (text: string, tone?: Toast['tone']) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>(() => repository.loadListings());
  const [favorites, setFavorites] = useState<string[]>(() => repository.loadFavorites());
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => repository.loadInquiries());
  const [role, setRoleState] = useState<DemoRole>(() => repository.loadRole());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const addListing = useCallback(
    (l: Listing) => {
      const next = [l, ...listings];
      const ok = repository.saveListings(next);
      if (!ok) return false;
      setListings(next);
      return true;
    },
    [listings],
  );

  const deleteListing = useCallback((id: string) => {
    setListings((prev) => {
      const next = prev.filter((l) => l.id !== id);
      repository.saveListings(next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        repository.saveFavorites(next);
        toast(prev.includes(id) ? 'הוסר מהמועדפים' : 'נשמר במועדפים', 'info');
        return next;
      });
    },
    [toast],
  );

  const addInquiry = useCallback((i: Omit<Inquiry, 'id' | 'createdAt'>) => {
    const item: Inquiry = { ...i, id: newId('inq'), createdAt: new Date().toISOString() };
    setInquiries((prev) => {
      const next = [item, ...prev];
      repository.saveInquiries(next);
      return next;
    });
    return item;
  }, []);

  const setRole = useCallback((r: DemoRole) => {
    repository.saveRole(r);
    setRoleState(r);
  }, []);

  const resetDemo = useCallback(() => {
    repository.reset();
    setListings(repository.loadListings());
    setFavorites([]);
    setInquiries([]);
    setRoleState('investor');
    toast('נתוני הדמו אופסו למצב ההתחלתי', 'info');
  }, [toast]);

  const value = useMemo<Store>(
    () => ({
      listings,
      favorites,
      inquiries,
      role,
      toasts,
      getListing: (id) => listings.find((l) => l.id === id),
      addListing,
      deleteListing,
      toggleFavorite,
      addInquiry,
      setRole,
      resetDemo,
      toast,
    }),
    [listings, favorites, inquiries, role, toasts, addListing, deleteListing, toggleFavorite, addInquiry, setRole, resetDemo, toast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
