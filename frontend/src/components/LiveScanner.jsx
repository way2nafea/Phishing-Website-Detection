import { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, AlertTriangle, ShieldCheck, Bug } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:10000';

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
      
      const res = await axios.post(`${API_BASE}${endpoint}`, payload);
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
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Live Threat Scanner</h2>
          <p className="text-gray-400">Instantly evaluate URLs or email contents against our neural network.</p>
        </div>

        <div className="glass rounded-3xl p-2 md:p-8 border border-white/10 shadow-2xl backdrop-blur-xl">
          
          <div className="flex justify-center mb-8">
            <div className="flex p-1 bg-white/5 rounded-full border border-white/5">
              {['url', 'email'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setResult(null); setError(null); }}
                  className={`relative px-8 py-2.5 text-sm font-medium rounded-full transition-colors ${activeTab === tab ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {activeTab === tab && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary/20 border border-primary/30 rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 uppercase tracking-wider">{tab}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleScan} className="relative max-w-2xl mx-auto">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder={activeTab === 'url' ? "https://example.com" : "Paste suspicious email body..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full bg-dark/50 border border-white/10 focus:border-primary/50 rounded-2xl py-4 pl-12 pr-36 text-white placeholder:text-gray-600 outline-none transition-all focus:ring-4 focus:ring-primary/10"
              />
              <button
                type="submit"
                disabled={loading || !input}
                className="absolute right-2 top-2 bottom-2 px-6 bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-primary rounded-xl text-white font-medium flex items-center justify-center transition-colors border border-primary/50 shadow-lg"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Scan Now"}
              </button>
            </div>
          </form>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="mt-8 max-w-2xl mx-auto bg-rose-500/10 border border-rose-500/20 text-rose-400 px-6 py-4 rounded-xl flex items-center gap-3"
              >
                <AlertTriangle className="w-5 h-5" /> {error}
              </motion.div>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-8 max-w-2xl mx-auto overflow-hidden"
              >
                <div className="bg-dark/50 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/5">
                    <div>
                      <p className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Analysis Status</p>
                      <div className="flex items-center gap-2">
                        {result.xx === 1 || result.status === 'SAFE' ? (
                          <><ShieldCheck className="w-6 h-6 text-emerald-400" /><span className="text-xl font-bold text-emerald-400">SECURE</span></>
                        ) : result.xx === 0 || result.status === 'SUSPICIOUS' ? (
                          <><AlertTriangle className="w-6 h-6 text-amber-400" /><span className="text-xl font-bold text-amber-400">SUSPICIOUS</span></>
                        ) : (
                          <><Bug className="w-6 h-6 text-rose-400" /><span className="text-xl font-bold text-rose-400">DANGEROUS</span></>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Risk Score</p>
                      <div className="text-3xl font-black font-mono text-white">
                        {Math.round(result.risk_score || 0)}<span className="text-gray-500 text-lg">/100</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Findings Details:</p>
                    <p className="text-white bg-white/5 p-4 rounded-xl border border-white/5 font-medium leading-relaxed">
                       {result.prediction || (result.issues && result.issues.length ? result.issues.join(". ") : "No overt threats detected in content.")}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </section>
  );
}
