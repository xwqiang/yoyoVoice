import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { speakText, speakWordWithExample } from '../../utils/studentNav'
import { KidButton } from './KidButton'

interface TeachingCardProps {
  wordEn: string
  meaningZh: string | null
  phonetic: string | null
  exampleSentence: string | null
  onDone: () => void
  embedded?: boolean
  doneLabel?: string
  disabled?: boolean
}

export function TeachingCard({
  wordEn,
  meaningZh,
  phonetic,
  exampleSentence,
  onDone,
  embedded = false,
  doneLabel = '我记住了!',
  disabled = false,
}: TeachingCardProps) {
  const spokenKey = useRef('')

  useEffect(() => {
    if (!wordEn.trim()) return
    const key = `${wordEn}|${exampleSentence ?? ''}`
    spokenKey.current = key
    const timer = window.setTimeout(() => {
      if (spokenKey.current === key) {
        speakWordWithExample(wordEn, exampleSentence)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [wordEn, exampleSentence])

  const card = (
    <motion.div
      className={`mx-4 flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl bg-white p-10 shadow-xl ${embedded ? '' : ''}`}
      initial={{ rotateY: embedded ? 0 : 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 120 }}
      style={embedded ? undefined : { perspective: 800 }}
    >
        <motion.h1
          className="text-center text-5xl font-extrabold text-violet-700"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 12 }}
        >
          {wordEn}
        </motion.h1>

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

        <motion.button
          className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-3xl text-violet-600 transition-colors active:bg-violet-200"
          whileTap={{ scale: 0.9 }}
          onClick={() => speakWordWithExample(wordEn, exampleSentence)}
          aria-label="播放单词和例句"
        >
          🔊
        </motion.button>

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

        {exampleSentence && (
          <motion.div
            className="w-full text-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <p className="text-sm font-bold text-slate-400 mb-2">例句</p>
            <p className="text-lg leading-relaxed text-gray-600 italic px-2">
              {exampleSentence}
            </p>
            <motion.button
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-sky-50 px-5 py-2 text-base font-bold text-sky-600 active:bg-sky-100"
              whileTap={{ scale: 0.95 }}
              onClick={() => speakText(exampleSentence, 'en-US', 0.8)}
              aria-label="朗读例句"
            >
              🔊 听例句
            </motion.button>
          </motion.div>
        )}

        <motion.div
          className="mt-4 w-full"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <KidButton color="purple" size="lg" onClick={onDone} disabled={disabled}>
            {doneLabel}
          </KidButton>
        </motion.div>
      </motion.div>
  )

  if (embedded) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        {card}
      </div>
    )
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-50/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {card}
    </motion.div>
  )
}
