import React from 'react';
import { MOCK_NEWS } from '../constants';
import { Lightbulb } from 'lucide-react';
import { motion } from 'motion/react';

export const SimpleView: React.FC = () => {
  const mainNews = MOCK_NEWS.slice(0, 3);
  const secondaryNews = MOCK_NEWS.slice(3);

  return (
    <div className="max-w-3xl mx-auto pt-12 pb-20">
      <section className="space-y-16">
        <div className="flex items-center justify-center space-x-3 text-on-surface-variant opacity-60 mb-12">
          <Lightbulb className="w-4 h-4" />
          <span className="text-xs uppercase tracking-widest font-semibold">Highlight any term to pulse query</span>
        </div>

        <div className="space-y-12">
          {mainNews.map((item, idx) => (
            <motion.article 
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="group"
            >
              <span className="text-primary text-[10px] font-bold tracking-[0.2em] uppercase block mb-3">
                {item.rank ? `${item.rank} / ` : ''}{item.category}
              </span>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface leading-tight hover:text-primary transition-colors cursor-pointer">
                {item.title}
              </h1>
              <div className="mt-4 flex items-center gap-4 text-on-surface-variant text-sm">
                <span>{item.timestamp}</span>
                <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                <span className="text-primary font-medium">{item.score || '9.0'} Pulse Score</span>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="pt-16 space-y-8 border-t border-surface-container-low">
          {secondaryNews.map((item, idx) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className="flex justify-between items-baseline group cursor-help"
            >
              <p className="text-lg text-on-surface-variant leading-relaxed max-w-xl group-hover:text-on-surface transition-colors">
                {item.title}
              </p>
              <span className="text-xs font-mono text-outline-variant">{item.timestamp}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Floating Interaction Hint */}
      <div className="fixed bottom-8 right-8 pointer-events-none">
        <div className="bg-surface-container-lowest shadow-xl border border-primary/10 px-4 py-2 rounded-full flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary pulse-dot shadow-[0_0_8px_#005bc1]"></div>
          <span className="text-[10px] font-headline font-bold text-primary tracking-widest uppercase">Live Pulse Active</span>
        </div>
      </div>
    </div>
  );
};
