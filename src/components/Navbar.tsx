import React, { useState } from 'react';
import { ViewMode } from '../types';
import { Moon, Search } from 'lucide-react';

interface NavbarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onViewChange }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm font-headline">
      <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <div 
            className="text-2xl font-black tracking-tighter text-on-surface cursor-pointer"
            onClick={() => onViewChange('home')}
          >
            AI Pulse
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <button 
              onClick={() => onViewChange('home')}
              className={`text-on-surface font-medium hover:text-primary transition-colors ${currentView === 'home' ? 'text-primary font-bold border-b-2 border-primary pb-1' : ''}`}
            >
              Home
            </button>
            <button 
              onClick={() => onViewChange('simple')}
              className={`text-on-surface font-medium hover:text-primary transition-colors ${currentView === 'simple' ? 'text-primary font-bold border-b-2 border-primary pb-1' : ''}`}
            >
              Simple
            </button>
            <button 
              onClick={() => onViewChange('normal')}
              className={`text-on-surface font-medium hover:text-primary transition-colors ${currentView === 'normal' ? 'text-primary font-bold border-b-2 border-primary pb-1' : ''}`}
            >
              Normal
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`relative flex items-center transition-all duration-300 ${isSearchOpen ? 'w-64' : 'w-10'}`}>
            <input 
              type="text" 
              placeholder="Search AI terms..."
              className={`w-full bg-surface-container-low rounded-full py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all ${isSearchOpen ? 'opacity-100' : 'opacity-0 cursor-default'}`}
              onBlur={() => setIsSearchOpen(false)}
            />
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="absolute left-0 p-2 hover:bg-surface-container-low rounded-full transition-colors"
            >
              <Search className="w-5 h-5 text-on-surface" />
            </button>
          </div>
          <button className="p-2 hover:bg-surface-container-low rounded-lg transition-all duration-300 scale-95 active:scale-90">
            <Moon className="w-5 h-5 text-on-surface" />
          </button>
        </div>
      </div>
    </nav>
  );
};
