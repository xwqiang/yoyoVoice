import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Achievement {
  type: string
  title: string
  desc: string
  emoji: string
}

interface AchievementToastProps {
  achievement: Achievement | null
  onDone: () => void
}

export function AchievementToast({ achievement, onDone }: AchievementToastProps) {
  useEffect(() => {
    if (!achievement) return
    const timer = setTimeout(onDone, 3000)
    return () => clearTimeout(timer)
  }, [achievement, onDone])

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          className="fixed top-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-xl border-2 border-amber-300"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <span className="text-4xl">{achievement.emoji}</span>
          <div>
            <p className="font-bold text-lg text-purple-700">{achievement.title}</p>
            <p className="text-sm text-gray-500">{achievement.desc}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
