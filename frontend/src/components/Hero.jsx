import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import { Button } from './UI/Button';
import { Card } from './UI/Card';

export default function Hero() {
  return (
    <div className="relative min-h-screen flex items-center pt-24 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/20 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center relative z-10 w-full">
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Enterprise-Grade Detection
          </motion.div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight mb-8">
            Identify threats <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">before they strike.</span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-10 max-w-lg leading-relaxed font-light">
            An advanced neural engine designed to proactively analyze, detect, and neutralize phishing attempts in real-time.
          </p>

          <div className="flex flex-wrap items-center gap-5">
            <a href="#scanner">
              <Button variant="primary" icon={<ArrowRight className="w-4 h-4 text-white/80" />}>
                Launch Scanner
              </Button>
            </a>
            <Button variant="glass">
              Read Documentation
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="relative lg:h-[600px] flex items-center justify-center pointer-events-none"
        >
          {/* Abstract UI Representation (Glass & Clay Hybrid) */}
          <Card className="w-full max-w-[480px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/[0.05] bg-dark/60 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-6 mb-6">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                   <ShieldCheck className="w-5 h-5 text-emerald-400" />
                 </div>
                 <div>
                   <h3 className="font-medium text-white">System Status</h3>
                   <p className="text-xs text-gray-500">All nodes operational</p>
                 </div>
               </div>
               <div className="px-3 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20 flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
               </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end mb-2">
                 <span className="text-sm text-gray-400">Scan Activity</span>
                 <Activity className="w-4 h-4 text-gray-500" />
              </div>
              {[...Array(4)].map((_, i) => (
                <motion.div 
                  key={i} 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 0.8 + (i * 0.15), duration: 0.8, ease: "easeOut" }}
                >
                  <div className="h-12 w-full bg-white/[0.02] rounded-xl border border-white/[0.05] relative overflow-hidden">
                    <motion.div 
                      className="absolute top-0 bottom-0 left-0 bg-primary/20"
                      initial={{ width: "0%" }}
                      animate={{ width: `${Math.random() * 60 + 30}%` }}
                      transition={{ delay: 1.5 + (i * 0.2), duration: 1.5, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

      </div>
    </div>
  );
}
