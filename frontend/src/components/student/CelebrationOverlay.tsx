import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

interface CelebrationOverlayProps {
  xpEarned: number
  levelUp: boolean
  show: boolean
  onDone: () => void
}

export function CelebrationOverlay({ xpEarned, levelUp, show, onDone }: CelebrationOverlayProps) {
  useEffect(() => {
    if (!show) return

    confetti({
      particleCount: levelUp ? 200 : 80,
      spread: levelUp ? 120 : 70,
      origin: { y: 0.5 },
      colors: ['#a855f7', '#6366f1', '#f59e0b', '#ec4899', '#10b981'],
    })

    const timer = setTimeout(onDone, 2000)
    return () => clearTimeout(timer)
  }, [show, levelUp, onDone])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="text-5xl font-extrabold text-white drop-shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ duration: 0.5, times: [0, 0.6, 1] }}
          >
            +{xpEarned} XP
          </motion.div>

          {levelUp && (
            <motion.div
              className="mt-4 text-4xl font-extrabold text-amber-300 drop-shadow-lg"
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: [0, 1.4, 1], rotate: [-10, 5, 0] }}
              transition={{ delay: 0.3, duration: 0.6, times: [0, 0.6, 1] }}
            >
              ⭐ Level Up! ⭐
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
