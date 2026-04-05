import { motion } from 'framer-motion';
import { Activity, AlertOctagon, CheckCircle2 } from 'lucide-react';

export default function DashboardPreview() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Command Center</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">Monitor your digital perimeter with our premium dashboard. Real-time alerts, automated logging, and comprehensive threat intelligence at a glance.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="relative rounded-2xl border border-white/10 glass shadow-2xl overflow-hidden max-w-5xl mx-auto"
        >
          {/* Mac window header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            <div className="ml-4 text-xs font-mono text-gray-500">nexus-admin-panel</div>
          </div>

          <div className="p-6 md:p-8 grid md:grid-cols-3 gap-6">
            
            {/* Left Column Stats */}
            <div className="space-y-6">
               <div className="p-5 rounded-xl bg-white/5 border border-white/5">
                 <div className="text-gray-400 text-sm mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Allowed Requests</div>
                 <div className="text-3xl font-bold text-white">482,910</div>
               </div>
               <div className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                 <div className="text-rose-400 text-sm mb-2 flex items-center gap-2"><AlertOctagon className="w-4 h-4" /> Blocked Threats</div>
                 <div className="text-3xl font-bold text-rose-500">1,204</div>
               </div>
            </div>

            {/* Main Log Area */}
            <div className="md:col-span-2 rounded-xl bg-dark/80 border border-white/5 p-6 overflow-hidden relative">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-white">Live Security Stream</h3>
                <Activity className="w-5 h-5 text-emerald-400" />
              </div>
              
              <div className="space-y-3 font-mono text-sm">
                <div className="flex gap-4 text-gray-400 pb-2 border-b border-white/5">
                  <span className="w-24">TIME</span>
                  <span className="w-32">EVENT</span>
                  <span className="flex-1">TARGET</span>
                  <span className="w-16 text-right">SCORE</span>
                </div>

                {[
                  { time: '14:02:41', event: 'Phishing', target: 'http://login-verify-account.com', score: '98', color: 'text-rose-400' },
                  { time: '14:02:35', event: 'Safe', target: 'https://stripe.com/docs', score: '05', color: 'text-emerald-400' },
                  { time: '14:00:12', event: 'Suspicious', target: 'http://free-gift-promo.xyz', score: '65', color: 'text-amber-400' },
                  { time: '13:58:04', event: 'Safe', target: 'https://github.com', score: '02', color: 'text-emerald-400' },
                ].map((log, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} 
                    whileInView={{ opacity: 1, x: 0 }} 
                    transition={{ delay: i * 0.1 }}
                    key={i} 
                    className="flex gap-4 items-center py-2 border-b border-white/5 hover:bg-white/5 transition-colors rounded px-2 -mx-2"
                  >
                    <span className="w-24 text-gray-500">{log.time}</span>
                    <span className={`w-32 ${log.color}`}>{log.event}</span>
                    <span className="flex-1 text-gray-300 truncate">{log.target}</span>
                    <span className="w-16 text-right text-gray-500">{log.score}</span>
                  </motion.div>
                ))}
              </div>
              
              {/* Fade bottom out */}
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-dark/80 to-transparent"></div>
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
}
