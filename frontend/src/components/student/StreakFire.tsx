import { motion } from 'framer-motion'

interface StreakFireProps {
  days: number
}

export function StreakFire({ days }: StreakFireProps) {
  if (days === 0) {
    return (
      <div className="flex items-center gap-1 opacity-40 grayscale">
        <span className="text-3xl">🔥</span>
        <span className="text-lg font-bold text-gray-400">0</span>
      </div>
    )
  }

  return (
    <motion.div
      className="flex items-center gap-1"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 12 }}
    >
      <motion.span
        className="text-3xl"
        animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.8 }}
      >
        🔥
      </motion.span>
      <span className="text-lg font-extrabold text-orange-500">{days}</span>
    </motion.div>
  )
}
