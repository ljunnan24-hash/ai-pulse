import { usePwaInstallContext } from '../../contexts/PwaInstallContext';

type ShortcutButtonVariant = 'hero' | 'footer';

export function ShortcutButton({ variant }: { variant: ShortcutButtonVariant }) {
  const { openInstallPrompt, canOfferShortcut } = usePwaInstallContext();

  if (!canOfferShortcut) return null;

  if (variant === 'hero') {
    return (
      <button
        type="button"
        onClick={openInstallPrompt}
        className="inline-flex h-[46px] items-center justify-center rounded-full border border-[#BFD3FF] bg-white px-5 text-[15px] font-bold text-[#1463FF] transition-colors hover:bg-[#F8FAFF]"
      >
        快捷方式
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openInstallPrompt}
      className="text-slate-500 transition hover:text-primary"
    >
      快捷方式
    </button>
  );
}
