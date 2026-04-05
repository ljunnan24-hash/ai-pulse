import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-12 px-6 bg-surface-container-low font-sans text-sm mt-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-8 max-w-7xl mx-auto">
        <div className="flex flex-col gap-2">
          <div className="font-headline font-bold text-on-surface text-lg">
            AI Pulse
          </div>
          <div className="text-on-surface-variant opacity-70">
            © 2024 AI Pulse. Curating Intelligence.
          </div>
        </div>
        <div className="flex flex-wrap md:justify-end gap-x-8 gap-y-4">
          <a className="text-on-surface-variant hover:text-primary hover:underline decoration-primary underline-offset-4 transition-opacity opacity-80 hover:opacity-100" href="#">Email Subscription</a>
          <a className="text-on-surface-variant hover:text-primary hover:underline decoration-primary underline-offset-4 transition-opacity opacity-80 hover:opacity-100" href="#">Privacy Policy</a>
          <a className="text-on-surface-variant hover:text-primary hover:underline decoration-primary underline-offset-4 transition-opacity opacity-80 hover:opacity-100" href="#">Terms</a>
        </div>
      </div>
    </footer>
  );
};
