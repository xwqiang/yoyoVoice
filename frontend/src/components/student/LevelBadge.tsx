import { motion } from 'framer-motion'

interface LevelBadgeProps {
  level: number
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'w-10 h-10 text-lg',
  md: 'w-16 h-16 text-2xl',
  lg: 'w-24 h-24 text-4xl',
}

const borderMap = {
  sm: 'p-[3px]',
  md: 'p-[4px]',
  lg: 'p-[5px]',
}

export function LevelBadge({ level, size = 'md' }: LevelBadgeProps) {
  return (
    <motion.div
      key={level}
      className={`rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 ${borderMap[size]}`}
      initial={{ scale: 1.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 12 }}
    >
      <div
        className={`flex items-center justify-center rounded-full bg-white font-extrabold text-purple-600 ${sizeMap[size]}`}
      >
        {level}
      </div>
    </motion.div>
  )
}
