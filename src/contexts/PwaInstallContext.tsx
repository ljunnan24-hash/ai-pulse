import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  detectPwaPlatform,
  dismissInstallPrompt,
  isStandaloneMode,
  type PwaPlatform,
} from '../lib/pwaInstall';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PwaInstallContextValue {
  visible: boolean;
  manualOpen: boolean;
  platform: PwaPlatform;
  installing: boolean;
  canNativeInstall: boolean;
  canOfferShortcut: boolean;
  openInstallPrompt: () => void;
  closeInstallPrompt: () => void;
  install: () => Promise<void>;
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [platform, setPlatform] = useState<PwaPlatform>('desktop');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  const canOfferShortcut = !isStandaloneMode();

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const openInstallPrompt = useCallback(() => {
    if (isStandaloneMode()) return;
    setPlatform(detectPwaPlatform());
    setManualOpen(true);
    setVisible(true);
  }, []);

  const closeInstallPrompt = useCallback(() => {
    setManualOpen(false);
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        dismissInstallPrompt();
        setManualOpen(false);
        setVisible(false);
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const canNativeInstall = deferredPrompt != null;

  const value = useMemo(
    () => ({
      visible,
      manualOpen,
      platform,
      installing,
      canNativeInstall,
      canOfferShortcut,
      openInstallPrompt,
      closeInstallPrompt,
      install,
    }),
    [
      visible,
      manualOpen,
      platform,
      installing,
      canNativeInstall,
      canOfferShortcut,
      openInstallPrompt,
      closeInstallPrompt,
      install,
    ],
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstallContext(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error('usePwaInstallContext must be used within PwaInstallProvider');
  }
  return ctx;
}
