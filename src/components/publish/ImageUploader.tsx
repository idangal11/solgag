'use client';

import { ImagePlus, Loader2, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { compressImage, MAX_IMAGES, type ExistingImage, type PendingImage } from './images';

interface Props {
  existing: ExistingImage[];
  pending: PendingImage[];
  onAdd: (images: PendingImage[]) => void;
  onRemoveExisting: (id: string) => void;
  onRemovePending: (key: string) => void;
}

export function ImageUploader({ existing, pending, onAdd, onRemoveExisting, onRemovePending }: Props) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const count = existing.length + pending.length;
  const room = MAX_IMAGES - count;

  const onFiles = async (files: File[]) => {
    const all = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    const list = all.slice(0, room);
    if (all.length > list.length) toast(`ניתן לצרף עד ${MAX_IMAGES} תמונות למודעה`, 'info');
    if (!list.length) return;
    setBusy(true);
    const added: PendingImage[] = [];
    let failed = 0;
    for (const file of list) {
      try {
        const blob = await compressImage(file);
        added.push({ key: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob) });
      } catch {
        failed++;
      }
    }
    setBusy(false);
    if (added.length) onAdd(added);
    if (failed) toast(failed === 1 ? 'לא ניתן לקרוא אחת התמונות (פורמט לא נתמך?)' : `לא ניתן לקרוא ${failed} תמונות (פורמט לא נתמך?)`, 'error');
  };

  return (
    <div className="field span2">
      <span id={`${inputId}-label`}>
        תמונות של המבנה והגג (עד {MAX_IMAGES}) · {count}/{MAX_IMAGES}
      </span>
      <ul className="uploader" aria-labelledby={`${inputId}-label`}>
        {existing.map((img, i) => (
          <li className="up-thumb" key={img.id}>
            <img src={img.url} alt={`תמונה ${i + 1}`} />
            <button type="button" className="icon-btn" aria-label={`הסרת תמונה ${i + 1}`} onClick={() => onRemoveExisting(img.id)}>
              <X size={14} />
            </button>
          </li>
        ))}
        {pending.map((img, i) => (
          <li className="up-thumb" key={img.key}>
            <img src={img.previewUrl} alt={`תמונה חדשה ${i + 1}`} />
            <span className="up-new">חדשה</span>
            <button type="button" className="icon-btn" aria-label={`הסרת תמונה חדשה ${i + 1}`} onClick={() => onRemovePending(img.key)}>
              <X size={14} />
            </button>
          </li>
        ))}
        {room > 0 && (
          <li className="up-add-item">
            <input
              id={inputId}
              className="up-input"
              type="file"
              accept="image/*"
              multiple
              disabled={busy}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = ''; // allow picking the same file again
                onFiles(files);
              }}
            />
            <label className="up-add" htmlFor={inputId} aria-busy={busy}>
              {busy ? <Loader2 className="spin" /> : <ImagePlus />}
              <span>{busy ? 'מעבד…' : 'הוספת תמונות'}</span>
            </label>
          </li>
        )}
      </ul>
      <small className="hint">
        התמונות מוקטנות בדפדפן (עד 1600 פיקסלים) ונשמרות ללא נתוני מיקום (EXIF). הן יועלו ויוצגו לכולם במודעה רק לאחר השמירה.
      </small>
    </div>
  );
}
