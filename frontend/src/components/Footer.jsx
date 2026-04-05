import { motion } from 'framer-motion';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 relative z-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center gap-2 mb-4 md:mb-0">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
             <div className="w-4 h-4 bg-primary rounded-sm" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">NEXUS</span>
        </div>
        
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <a href="#" className="hover:text-white transition-colors">Documentation</a>
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <a href="#" className="hover:text-white transition-colors">Terms</a>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-8 text-center md:text-left text-xs text-gray-600">
        &copy; {new Date().getFullYear()} NEXUS Security Systems. All rights reserved. Designed for enterprise protection.
      </div>
    </footer>
  );
}
