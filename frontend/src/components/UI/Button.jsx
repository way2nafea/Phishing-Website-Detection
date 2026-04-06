import { motion } from 'framer-motion';

export function Button({ children, onClick, type = "button", disabled, variant = "primary", className = "", icon }) {
  const baseClasses = "relative px-6 py-3 font-medium flex items-center justify-center gap-2 overflow-hidden interactive group";
  
  const variants = {
    primary: "clay-btn text-white",
    glass: "glass text-white hover:bg-white/[0.08]"
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      whileHover={!disabled ? { scale: 1.02, y: -2 } : {}}
      whileTap={!disabled ? { scale: 0.98, y: 0 } : {}}
    >
      {/* Glossy top highlight for Clay styling */}
      {variant === 'primary' && (
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none rounded-t-xl" />
      )}
      
      <span className="relative z-10 flex items-center gap-2">
        {children}
        {icon && <span className="group-hover:translate-x-1 transition-transform duration-300">{icon}</span>}
      </span>
    </motion.button>
  );
}
