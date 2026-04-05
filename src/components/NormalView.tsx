import React from 'react';
import { MOCK_NEWS } from '../constants';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export const NormalView: React.FC = () => {
  const rank1 = MOCK_NEWS[0];
  const rank2 = MOCK_NEWS[1];
  const rank3 = MOCK_NEWS[2];

  return (
    <div className="max-w-7xl mx-auto pt-12 pb-20">
      <section className="mb-20">
        <div className="flex flex-col items-center text-center mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full bg-primary pulse-dot"></div>
            <span className="text-primary font-bold tracking-[0.2em] uppercase text-sm">Weekly Leaderboard</span>
          </div>
          <h2 className="font-headline font-extrabold text-4xl md:text-5xl tracking-tight max-w-2xl text-on-surface">
            This Week's Hot AI Rankings
          </h2>
          <p className="text-on-surface-variant mt-4 text-lg max-w-xl">
            Curated intelligence tracking the most impactful movements in the artificial intelligence landscape.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Rank 1 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-12 xl:col-span-8 group relative overflow-hidden rounded-3xl bg-surface-container-lowest shadow-[0px_20px_50px_rgba(0,91,193,0.08)] border border-primary/5"
          >
            <div className="flex flex-col md:flex-row h-full">
              <div className="md:w-1/2 h-64 md:h-auto overflow-hidden">
                <img 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  src={rank1.imageUrl} 
                  alt={rank1.title}
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-6">
                  <span className="px-4 py-1.5 bg-primary text-white text-xs font-black rounded-full uppercase tracking-widest shadow-lg shadow-primary/20">Rank {rank1.rank}</span>
                  <span className="text-primary font-headline font-bold text-lg">{rank1.score} Pulse Score</span>
                </div>
                <h3 className="font-headline font-extrabold text-3xl md:text-4xl mb-4 text-on-surface leading-tight">
                  {rank1.title}
                </h3>
                <p className="text-on-surface-variant text-lg leading-relaxed mb-8">
                  {rank1.description}
                </p>
                <a className="inline-flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all group/link" href={rank1.link}>
                  <span>View Full Research</span>
                  <ArrowRight className="w-5 h-5 transition-transform" />
                </a>
              </div>
            </div>
          </motion.div>

          {/* Rank 2 & 3 */}
          <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-8">
            {[rank2, rank3].map((item, idx) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * (idx + 1) }}
                className="flex-1 group relative overflow-hidden rounded-3xl bg-surface-container-lowest p-6 shadow-[0px_12px_32px_rgba(0,91,193,0.06)] border border-outline-variant/10"
              >
                <div className="flex gap-6">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm">
                    <img 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      src={item.imageUrl} 
                      alt={item.title}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-surface-container-low text-on-surface-variant text-[10px] font-black rounded uppercase tracking-widest">Rank {item.rank}</span>
                      <span className="text-primary font-headline font-bold text-xs">{item.score} Pulse</span>
                    </div>
                    <h3 className="font-headline font-bold text-xl mb-2 text-on-surface">{item.title}</h3>
                    <p className="text-on-surface-variant text-sm line-clamp-2 mb-3 leading-relaxed">
                      {item.description}
                    </p>
                    <a className="text-primary text-xs font-bold hover:underline" href={item.link}>Read More</a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
