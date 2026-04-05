import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Activity } from 'lucide-react';

export default function Hero() {
  return (
    <div className="relative min-h-screen flex items-center pt-24 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center relative z-10 w-full">
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Real-Time Threat Intelligence
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight mb-6">
            Detect Phishing <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Before It Strikes</span>
          </h1>
          
          <p className="text-lg text-gray-400 mb-8 max-w-lg leading-relaxed">
            AI-powered cybersecurity system for real-time threat detection. Protect your digital assets with our advanced neural scanning engine.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a href="#scanner" className="px-8 py-4 bg-primary hover:bg-blue-600 text-white rounded-full font-medium flex items-center gap-2 shadow-lg shadow-primary/25 transition-all hover:scale-105 active:scale-95">
              Scan Now <ArrowRight className="w-4 h-4" />
            </a>
            <button className="px-8 py-4 glass text-white rounded-full font-medium flex items-center gap-2 hover:bg-white/5 transition-all">
              View Demo
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative lg:h-[500px] flex items-center justify-center pointer-events-none"
        >
          {/* Abstract Interface Representation */}
          <div className="w-full max-w-md glass rounded-2xl p-6 border border-white/10 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
               <div className="flex items-center gap-3">
                 <ShieldCheck className="w-6 h-6 text-emerald-400" />
                 <span className="font-semibold text-white">System Secure</span>
               </div>
               <Activity className="w-5 h-5 text-gray-500" />
            </div>
            
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 w-full bg-white/5 rounded-lg border border-white/5 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
