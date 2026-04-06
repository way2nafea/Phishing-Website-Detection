import { useState } from 'react';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, AlertTriangle, ShieldCheck, Bug } from 'lucide-react';
import { Card } from './UI/Card';

export default function LiveScanner() {
  const [activeTab, setActiveTab] = useState('url');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const endpoint = activeTab === 'url' ? '/scan-url' : '/scan-email';
      const payload = activeTab === 'url' ? { url: input } : { message: input };
      
      const res = await api.post(endpoint, payload);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect to scanner engine.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="scanner" className="py-24 relative z-10 w-full">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">Live Threat Analysis</h2>
          <p className="text-gray-400 text-lg">Instantly evaluate URLs or email contents against our neural network.</p>
        </motion.div>

        <Card className="p-4 md:p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] backdrop-blur-3xl bg-dark/40 border-white/[0.04]" hover={false}>
          
          <div className="flex justify-center mb-10">
            <div className="flex p-1.5 bg-white/[0.02] rounded-2xl border border-white/[0.05] shadow-inner">
              {['url', 'email'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setResult(null); setError(null); }}
                  className={`relative px-10 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeTab === tab ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {activeTab === tab && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-[#1e293b] shadow-clay-sm border border-white/[0.02] rounded-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 uppercase tracking-widest">{tab}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleScan} className="relative max-w-2xl mx-auto">
            <div className="relative flex items-center group">
              <Search className="absolute left-6 w-5 h-5 text-gray-500 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder={activeTab === 'url' ? "https://example.com" : "Paste suspicious email body..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full clay-input rounded-2xl py-5 pl-14 pr-40 text-white placeholder:text-gray-600 outline-none text-lg interactive"
              />
              <button
                type="submit"
                disabled={loading || !input}
                className="absolute right-3 top-3 bottom-3 px-8 clay-btn disabled:opacity-50 text-white font-medium flex items-center justify-center interactive"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : "Scan Data"}
              </button>
            </div>
          </form>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="mt-8 max-w-2xl mx-auto bg-rose-500/10 border border-rose-500/20 text-rose-400 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
              >
                <AlertTriangle className="w-5 h-5" /> {error}
              </motion.div>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-10 max-w-2xl mx-auto overflow-hidden"
              >
                <div className="bg-[#0c0c0c] border border-white/[0.04] rounded-2xl p-8 shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-32 bg-primary/5 blur-[100px]" />
                  <div className="relative z-10 flex items-center justify-between mb-8 pb-8 border-b border-white/[0.05]">
                    <div>
                      <p className="text-gray-500 text-xs mb-2 uppercase tracking-widest font-semibold">Analysis Status</p>
                      <div className="flex items-center gap-3">
                        {result.xx === 1 || result.status === 'SAFE' ? (
                          <><ShieldCheck className="w-8 h-8 text-emerald-400" /><span className="text-2xl font-bold text-emerald-400">SECURE</span></>
                        ) : result.xx === 0 || result.status === 'SUSPICIOUS' ? (
                          <><AlertTriangle className="w-8 h-8 text-amber-400" /><span className="text-2xl font-bold text-amber-400">SUSPICIOUS</span></>
                        ) : (
                          <><Bug className="w-8 h-8 text-rose-400" /><span className="text-2xl font-bold text-rose-400">DANGEROUS</span></>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-xs mb-2 uppercase tracking-widest font-semibold">Risk Score</p>
                      <div className="text-4xl font-black font-mono text-white">
                        {Math.round(result.risk_score || 0)}<span className="text-gray-600 text-xl font-sans font-medium">/100</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative z-10">
                    <p className="text-gray-500 text-sm mb-3">Findings Overview:</p>
                    <p className="text-gray-300 bg-white/[0.02] p-5 rounded-xl border border-white/[0.03] font-medium leading-relaxed shadow-inner">
                       {result.prediction || (result.issues && result.issues.length ? result.issues.join(". ") : "No overt threats detected in content.")}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </Card>
      </div>
    </section>
  );
}
