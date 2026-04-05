import { motion } from 'framer-motion';

export default function Stats() {
  const stats = [
    { value: "99.9%", label: "Detection Accuracy" },
    { value: "<50ms", label: "Average Latency" },
    { value: "48M+", label: "Threats Blocked" },
    { value: "24/7", label: "Active Protection" },
  ];

  return (
    <section className="py-24 border-y border-white/5 bg-dark/50 relative z-10">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/5">
        {stats.map((stat, idx) => (
          <motion.div 
             key={idx}
             initial={{ opacity: 0, scale: 0.9 }}
             whileInView={{ opacity: 1, scale: 1 }}
             viewport={{ once: true }}
             transition={{ duration: 0.5, delay: idx * 0.1 }}
             className="text-center px-4"
          >
            <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent mb-2">
              {stat.value}
            </div>
            <div className="text-sm text-gray-500 uppercase tracking-widest font-medium">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
