import React from 'react';
import Layout from './components/Layout';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import LiveScanner from './components/LiveScanner';
import DashboardPreview from './components/DashboardPreview';
import Stats from './components/Stats';
import Footer from './components/Footer';

function App() {
  return (
    <Layout>
      <Navbar />
      <main>
        <Hero />
        <Features />
        
        {/* Crisp Decorative Divider */}
        <div className="max-w-6xl mx-auto w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent my-12" />
        
        <LiveScanner />
        <DashboardPreview />
        <Stats />
      </main>
      <Footer />
    </Layout>
  );
}

export default App;
