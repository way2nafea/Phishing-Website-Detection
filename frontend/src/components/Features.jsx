import { motion } from 'framer-motion';
import { Globe, Mail, Zap, ShieldAlert, Cpu } from 'lucide-react';

const features = [
  {
    icon: <Globe className="w-6 h-6 text-blue-400" />,
    title: "URL Scanner",
    desc: "Deep inspection of domain age, SSL, and structural anomalies to catch zero-day links."
  },
  {
    icon: <Mail className="w-6 h-6 text-purple-400" />,
    title: "Email & SMS Scanner",
    desc: "Natural language processing to detect urgency, requests for credentials, and malicious intent."
  },
  {
    icon: <Zap className="w-6 h-6 text-amber-400" />,
    title: "Real-Time Detection",
    desc: "Sub-second response times using optimized deep learning models for immediate threat blocking."
  },
  {
    icon: <ShieldAlert className="w-6 h-6 text-rose-400" />,
    title: "Risk Score Analysis",
    desc: "Granular confidence levels assigned to every scan, detailing exactly why a threat was flagged."
  },
  {
    icon: <Cpu className="w-6 h-6 text-emerald-400" />,
    title: "Threat Intelligence",
    desc: "Constantly updating database crowdsourced from live reports and global security feeds."
  }
];

export default function Features() {
  return (
    <section id="features" className="py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">Enterprise Grade Security</h2>
          <p className="text-gray-400">Our suite of tools is designed to proactively hunt and neutralize threats before they reach your network.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              whileHover={{ y: -5 }}
              className="glass p-6 rounded-2xl hover:bg-cardHover transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 border border-white/5 group-hover:border-white/10 transition-colors">
                {feat.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{feat.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
