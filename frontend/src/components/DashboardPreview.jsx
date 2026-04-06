import { motion } from 'framer-motion';
import { Activity, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { Card } from './UI/Card';

export default function DashboardPreview() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center mb-20 max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Command Center</h2>
          <p className="text-gray-400 text-lg">Monitor your digital perimeter with our premium dashboard. Real-time alerts, automated logging, and comprehensive threat intelligence at a glance.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl mx-auto"
        >
          <Card className="!p-0 border-white/[0.08]" hover={false}>
            {/* Mac window header */}
            <div className="flex items-center gap-2 px-6 py-4 bg-white/[0.02] border-b border-white/[0.05]">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500/80 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
              <div className="ml-4 text-xs font-mono text-gray-500 tracking-wider">nexus-admin-panel</div>
            </div>

            <div className="p-8 grid md:grid-cols-3 gap-8">
              
              {/* Left Column Stats */}
              <div className="space-y-6">
                 <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-white/[0.04] shadow-inner relative overflow-hidden">
                   <div className="text-gray-500 text-xs mb-3 flex items-center gap-2 uppercase tracking-widest"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Allowed Requests</div>
                   <div className="text-4xl font-black text-white">482,910</div>
                 </div>
                 <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/10 shadow-inner relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-16 bg-rose-500/10 blur-[50px] pointer-events-none" />
                   <div className="text-rose-400 text-xs mb-3 flex items-center gap-2 uppercase tracking-widest relative z-10"><AlertOctagon className="w-4 h-4" /> Blocked Threats</div>
                   <div className="text-4xl font-black text-rose-500 relative z-10">1,204</div>
                 </div>
              </div>

              {/* Main Log Area */}
              <div className="md:col-span-2 rounded-2xl bg-[#0c0c0c] border border-white/[0.04] p-8 overflow-hidden relative shadow-inner">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.05]">
                  <h3 className="font-semibold text-white tracking-wide">Live Security Stream</h3>
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <Activity className="w-3 h-3" /> Active
                  </div>
                </div>
                
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex gap-4 text-gray-500 pb-3 uppercase text-xs tracking-widest">
                    <span className="w-24">Time</span>
                    <span className="w-32">Event</span>
                    <span className="flex-1">Target</span>
                    <span className="w-16 text-right">Score</span>
                  </div>

                  {[
                    { time: '14:02:41', event: 'Phishing', target: 'http://login-verify-account.com', score: '98', color: 'text-rose-400' },
                    { time: '14:02:35', event: 'Safe', target: 'https://stripe.com/docs', score: '05', color: 'text-emerald-400' },
                    { time: '14:00:12', event: 'Suspicious', target: 'http://free-gift-promo.xyz', score: '65', color: 'text-amber-400' },
                    { time: '13:58:04', event: 'Safe', target: 'https://github.com', score: '02', color: 'text-emerald-400' },
                  ].map((log, i) => (
                    <motion.div 
                      cancel
                      initial={{ opacity: 0, x: -10 }} 
                      whileInView={{ opacity: 1, x: 0 }} 
                      transition={{ delay: i * 0.1 }}
                      key={i} 
                      className="flex gap-4 items-center py-3 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors rounded-lg px-3 -mx-3 interactive"
                    >
                      <span className="w-24 text-gray-600">{log.time}</span>
                      <span className={`w-32 font-bold ${log.color}`}>{log.event}</span>
                      <span className="flex-1 text-gray-300 truncate">{log.target}</span>
                      <span className="w-16 text-right text-gray-500">{log.score}</span>
                    </motion.div>
                  ))}
                </div>
                
                {/* Fade bottom out */}
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0c0c0c] to-transparent pointer-events-none"></div>
              </div>

            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
