import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Home } from '../components/Home';
import { SimpleView } from '../components/SimpleView';
import { NormalView } from '../components/NormalView';
import { SuccessView } from '../components/SuccessView';
import type { SuccessPanel, ViewMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function MarketingApp() {
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  const [successPanel, setSuccessPanel] = useState<SuccessPanel | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('confirmed') === '1') {
      const pendingEmail = window.sessionStorage.getItem('aipulse_last_subscribe_email');
      setSuccessPanel({
        title: 'Subscription confirmed',
        description:
          `Your email is verified${pendingEmail ? ` (${pendingEmail})` : ''}. If a digest was already published, you should have received it. Weekly issues arrive in Chinese every Monday at 9:00 (Beijing time).`,
      });
      setCurrentView('success');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('unsubscribed') === '1') {
      setSuccessPanel({
        title: 'You are unsubscribed',
        description: 'You will no longer receive AI Pulse emails. You can subscribe again anytime from the home page.',
      });
      setCurrentView('success');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('preferences_saved') === '1') {
      setSuccessPanel({
        title: 'Preferences saved',
        description: 'Your delivery mode and keywords have been updated.',
      });
      setCurrentView('success');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error') === 'invalid_token') {
      setSuccessPanel({
        title: 'Link invalid or expired',
        description: 'Please subscribe again from the home page, or use the latest link from your email.',
      });
      setCurrentView('success');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('already_confirmed') === '1') {
      setSuccessPanel({
        title: 'Already confirmed',
        description: 'This email was already verified. If you need help, subscribe again from the home page.',
      });
      setCurrentView('success');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return (
          <Home
            onSubscribePending={(email) => {
              window.sessionStorage.setItem('aipulse_last_subscribe_email', email);
              setSuccessPanel({
                title: 'Check your email',
                description: `We sent a confirmation link (in Chinese) to ${email}. Please open that inbox and click “确认订阅”.`,
              });
              setCurrentView('success');
            }}
          />
        );
      case 'simple':
        return <SimpleView />;
      case 'normal':
        return <NormalView />;
      case 'success':
        return (
          <SuccessView
            panel={successPanel}
            onBackToHome={() => {
              setSuccessPanel(null);
              setCurrentView('home');
            }}
          />
        );
      default:
        return (
          <Home
            onSubscribePending={(email) => {
              window.sessionStorage.setItem('aipulse_last_subscribe_email', email);
              setSuccessPanel({
                title: 'Check your email',
                description: `We sent a confirmation link (in Chinese) to ${email}. Please open that inbox and click “确认订阅”.`,
              });
              setCurrentView('success');
            }}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface selection:bg-primary-container selection:text-on-primary-container">
      <Navbar currentView={currentView} onViewChange={setCurrentView} />

      <main className="flex-grow pt-20 px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}

