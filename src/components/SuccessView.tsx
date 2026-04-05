import React from 'react';
import { motion } from 'motion/react';
import { Check, ArrowRight } from 'lucide-react';
import type { SuccessPanel } from '../types';

interface SuccessViewProps {
  onBackToHome: () => void;
  panel?: SuccessPanel | null;
}

export const SuccessView: React.FC<SuccessViewProps> = ({ onBackToHome, panel }) => {
  const title = panel?.title ?? 'Subscription confirmed';
  const description =
    panel?.description ??
    "You're all set. Weekly digests are sent in Chinese (Beijing time, Monday 9:00) with your chosen mode and keywords.";

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full bg-surface-container-lowest rounded-[2rem] p-12 text-center shadow-[0px_40px_100px_rgba(0,91,193,0.05)] border border-primary/5"
      >
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-primary-container rounded-full flex items-center justify-center shadow-inner">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
              <Check className="text-white w-6 h-6 stroke-[3]" />
            </div>
          </div>
        </div>

        <h1 className="font-headline font-extrabold text-4xl md:text-5xl text-on-surface tracking-tight mb-6">
          {title}
        </h1>
        
        <p className="text-on-surface-variant text-lg leading-relaxed mb-12 max-w-md mx-auto">
          {description}
        </p>

        <div className="space-y-6">
          <button 
            onClick={onBackToHome}
            className="w-full bg-primary-container hover:bg-primary-container/80 text-primary font-headline font-bold py-4 px-8 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 group"
          >
            <span>Back to home</span>
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
