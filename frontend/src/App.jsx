import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import LiveScanner from './components/LiveScanner';
import DashboardPreview from './components/DashboardPreview';
import Stats from './components/Stats';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-dark selection:bg-primary/30 text-slate-100 overflow-x-hidden font-sans relative">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-dark to-dark pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay" />

      <Navbar />
      <main>
        <Hero />
        <Features />
        
        {/* Decorative divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        <LiveScanner />
        <DashboardPreview />
        <Stats />
      </main>
      <Footer />
    </div>
  );
}

export default App;
