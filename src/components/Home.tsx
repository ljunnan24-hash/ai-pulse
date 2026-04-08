import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Bolt, Filter } from 'lucide-react';

import { apiBase } from '../config';

interface HomeProps {
  onSubscribePending: () => void;
}

export const Home: React.FC<HomeProps> = ({ onSubscribePending }) => {
  const [mode, setMode] = useState<'simple' | 'normal'>('normal');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const SUGGESTED_KEYWORDS = ['Generative AI', 'Neural Networks'];

  const addKeyword = (tag: string) => {
    if (keywords.length < 3 && !keywords.includes(tag)) {
      setKeywords([...keywords, tag]);
    }
    inputRef.current?.focus();
  };

  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim() && keywords.length < 3) {
      if (!keywords.includes(inputValue.trim())) {
        setKeywords([...keywords, inputValue.trim()]);
      }
      setInputValue('');
    }
  };

  const removeKeyword = (tag: string) => {
    setKeywords(keywords.filter(k => k !== tag));
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-4xl mx-auto pt-12 pb-20">
      <header className="mb-12 text-center md:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-container rounded-full mb-4">
          <div className="w-2 h-2 rounded-full bg-surface-tint pulse-dot"></div>
          <span className="text-[0.75rem] font-medium text-on-primary-container uppercase tracking-wider">Intelligence Alert</span>
        </div>
        <h1 className="font-headline font-extrabold text-5xl md:text-6xl tracking-tighter text-on-surface leading-tight mb-4">
          Curate Your <span className="text-primary">Intelligence.</span>
        </h1>
        <p className="text-lg text-on-surface-variant max-w-2xl leading-relaxed">
          Stay ahead of the curve. Enter your interests and we'll notify you the moment relevant breakthroughs surface. No account required.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <section className="lg:col-span-7 bg-surface-container-lowest rounded-3xl p-8 md:p-12 shadow-sm border border-outline-variant/10">
          <div className="mb-8 flex flex-col items-start gap-4">
            <p className="font-headline font-bold text-lg text-on-surface">Which mode do you prefer?</p>
            <div className="inline-flex p-1 bg-surface-container-low rounded-xl">
              <button 
                onClick={() => setMode('simple')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${mode === 'simple' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Simple
              </button>
              <button 
                onClick={() => setMode('normal')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${mode === 'normal' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Normal
              </button>
            </div>
          </div>

          <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-3">
              <label className="font-headline font-bold text-lg text-on-surface" htmlFor="email">Where should we send the pulse?</label>
              <input 
                className="w-full bg-surface-container-low border-none rounded-xl py-4 px-6 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all duration-300 text-on-surface placeholder:text-outline-variant/60 outline-none"
                id="email" 
                name="aipulse_email"
                placeholder="email@example.com" 
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <p className="text-sm text-on-surface-variant/70 italic">We strictly respect your privacy. One-click unsubscribe always.</p>
            </div>

            <div className="space-y-3">
              <label className="font-headline font-bold text-lg text-on-surface" htmlFor="keywords">
                What topics drive you? <span className="font-normal text-on-surface-variant">(0-3 keywords)</span>
              </label>
              
              {/* Suggested Keywords */}
              <div className="flex flex-wrap gap-2 mb-4">
                {SUGGESTED_KEYWORDS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addKeyword(tag)}
                    disabled={keywords.includes(tag)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
                      keywords.includes(tag) 
                        ? 'bg-surface-container-low text-on-surface-variant opacity-50 cursor-not-allowed' 
                        : 'bg-primary-container/30 text-primary hover:bg-primary-container/50'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Tag Input Container (The "Dialog") */}
              <div 
                className="w-full bg-surface-container-low rounded-xl p-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-surface-container-lowest transition-all duration-300 flex flex-wrap gap-2 items-center min-h-[64px] cursor-text"
                onClick={() => inputRef.current?.focus()}
              >
                {keywords.map(tag => (
                  <span key={tag} className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                    {tag}
                    <X className="w-3 h-3 cursor-pointer hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); removeKeyword(tag); }} />
                  </span>
                ))}
                <input 
                  ref={inputRef}
                  className="flex-1 bg-transparent border-none py-2 px-4 text-on-surface placeholder:text-outline-variant/60 outline-none min-w-[150px]"
                  id="keywords" 
                  placeholder={keywords.length === 0 ? "Type a keyword and press enter..." : ""} 
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleAddKeyword}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                type="button"
                disabled={loading}
                onClick={async () => {
                  setFormError(null);
                  if (!email.trim()) {
                    setFormError('Please enter a valid email address.');
                    return;
                  }
                  setLoading(true);
                  try {
                    const res = await fetch(`${apiBase()}/api/subscribe`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: email.trim(),
                        mode,
                        keywords,
                      }),
                    });
                    const data = res.ok ? null : await res.json().catch(() => null);
                    if (!res.ok) {
                      let msg = `Request failed (${res.status})`;
                      if (data && typeof data === 'object' && 'detail' in data) {
                        const d = (data as { detail: unknown }).detail;
                        if (typeof d === 'string') msg = d;
                        else if (Array.isArray(d))
                          msg = d.map((x) => (typeof x === 'object' && x && 'msg' in x ? String((x as { msg: unknown }).msg) : String(x))).join('; ');
                      }
                      setFormError(msg);
                      return;
                    }
                    onSubscribePending();
                  } catch {
                    setFormError('Network error. Is the API running?');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="flex-1 bg-primary hover:bg-primary-dim disabled:opacity-60 text-surface-container-lowest font-headline font-bold py-4 px-8 rounded-full transition-all duration-300 transform active:scale-95 shadow-lg shadow-primary/10"
              >
                {loading ? 'Sending…' : 'Confirm subscription'}
              </button>
              <button
                type="button"
                className="flex-1 bg-primary-container hover:bg-surface-container-low text-on-primary-container font-headline font-bold py-4 px-8 rounded-full transition-all duration-300 transform active:scale-95"
                onClick={() => {
                  setEmail('');
                  setKeywords([]);
                  setInputValue('');
                }}
              >
                Clear
              </button>
            </div>
            {formError ? (
              <p className="text-sm text-red-600 dark:text-red-400 pt-2" role="alert">
                {formError}
              </p>
            ) : null}
          </form>
        </section>

        <aside className="lg:col-span-5 space-y-8">
          <div className="bg-surface-container-low rounded-3xl p-8 border border-outline-variant/5">
            <h3 className="font-headline font-bold text-xl mb-4 text-on-surface">Why Subscribe?</h3>
            <ul className="space-y-6">
              <li className="flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-surface-container-lowest rounded-xl flex items-center justify-center text-primary">
                  <Bolt className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface">Zero Latency</h4>
                  <p className="text-sm text-on-surface-variant">Get notified the second a breakthrough hits our index.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-surface-container-lowest rounded-xl flex items-center justify-center text-primary">
                  <Filter className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface">Hyper-Niche</h4>
                  <p className="text-sm text-on-surface-variant">No generic noise. Only news containing your specific pulse points.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="relative overflow-hidden rounded-3xl h-64 shadow-xl group">
            <img 
              alt="AI Pulse Engine" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
              src="https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80&w=800"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
              <span className="text-white/80 text-xs font-medium uppercase tracking-widest mb-1">Live Feed</span>
              <span className="text-white font-headline font-bold text-lg">AI Pulse Engine v4.2 Active</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
