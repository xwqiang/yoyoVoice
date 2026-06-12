import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { speakWord } from '../../utils/studentNav'
import { KidButton } from './KidButton'

interface TeachingCardProps {
  wordEn: string
  meaningZh: string | null
  phonetic: string | null
  exampleSentence: string | null
  onDone: () => void
}

export function TeachingCard({ wordEn, meaningZh, phonetic, exampleSentence, onDone }: TeachingCardProps) {
  useEffect(() => {
    const timer = setTimeout(() => speakWord(wordEn), 400)
    return () => clearTimeout(timer)
  }, [wordEn])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-50/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="mx-4 flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl bg-white p-10 shadow-xl"
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 120 }}
        style={{ perspective: 800 }}
      >
        {/* Word */}
        <motion.h1
          className="text-center text-5xl font-extrabold text-violet-700"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 12 }}
        >
          {wordEn}
        </motion.h1>

        {/* Phonetic */}
        {phonetic && (
          <motion.p
            className="text-xl text-indigo-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            {phonetic}
          </motion.p>
        )}

        {/* Speaker button */}
        <motion.button
          className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-3xl text-violet-600 transition-colors active:bg-violet-200"
          whileTap={{ scale: 0.9 }}
          onClick={() => speakWord(wordEn)}
          aria-label="播放发音"
        >
          🔊
        </motion.button>

        {/* Chinese meaning */}
        {meaningZh && (
          <motion.p
            className="text-center text-3xl font-bold text-gray-800"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {meaningZh}
          </motion.p>
        )}

        {/* Example sentence */}
        {exampleSentence && (
          <motion.p
            className="text-center text-lg leading-relaxed text-gray-500 italic"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {exampleSentence}
          </motion.p>
        )}

        {/* Proceed button */}
        <motion.div
          className="mt-4 w-full"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <KidButton color="purple" size="lg" onClick={onDone}>
            我记住了!
          </KidButton>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
