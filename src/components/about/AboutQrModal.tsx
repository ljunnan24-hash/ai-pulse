import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

type AboutQrModalProps = {
  open: boolean;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  onClose: () => void;
};

export function AboutQrModal({
  open,
  title,
  description,
  imageSrc,
  imageAlt,
  onClose,
}: AboutQrModalProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setImageFailed(false);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [imageSrc, open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/45 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-qr-modal-title"
        className="w-full max-w-sm rounded-[var(--radius-card)] border border-[#D8E2F0] bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="about-qr-modal-title" className="font-headline text-base font-bold text-slate-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
        {imageFailed ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            二维码图片暂未加载成功，请稍后重试，或通过页面中的邮箱联系。
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={imageAlt}
            width={280}
            height={280}
            onError={() => setImageFailed(true)}
            className="mx-auto mt-4 aspect-square w-full max-w-[280px] rounded-lg border border-[#E8EDF5] bg-white object-contain p-1"
          />
        )}
      </div>
    </div>
  );
}
