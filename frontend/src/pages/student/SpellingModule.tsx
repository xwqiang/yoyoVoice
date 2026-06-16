import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../../api/client'
import { ModuleShell } from '../../components/student/ModuleShell'
import { KidButton } from '../../components/student/KidButton'
import { CelebrationOverlay } from '../../components/student/CelebrationOverlay'
import { AchievementToast } from '../../components/student/AchievementToast'
import {
  getModuleConfig,
  goToModuleHome,
  moduleProgressLabel,
  pickNextWord,
} from '../../utils/moduleHelpers'
import { speakWord } from '../../utils/studentNav'
import { playCorrectSound, playWrongSound } from '../../utils/sounds'
import type { AchievementData, DailyPlan, GamificationData } from '../../types'

interface LetterTile {
  id: number
  char: string
}

export function SpellingModule() {
  const { childId } = useParams<{ childId: string }>()
  const navigate = useNavigate()
  const config = getModuleConfig('spelling')

  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [poolSize, setPoolSize] = useState(0)
  const [sessionDone, setSessionDone] = useState(0)
  const [speakText, setSpeakText] = useState('')
  const [wordId, setWordId] = useState(0)
  const [planItemId, setPlanItemId] = useState<number | undefined>()
  const [meaning, setMeaning] = useState<string | null>(null)
  const [promptType, setPromptType] = useState<'meaning' | 'listen'>('listen')
  const [available, setAvailable] = useState<LetterTile[]>([])
  const [slots, setSlots] = useState<(LetterTile | null)[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [error, setError] = useState('')
  const [needLearnFirst, setNeedLearnFirst] = useState(false)
  const [startTime, setStartTime] = useState(Date.now())

  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationXp, setCelebrationXp] = useState(0)
  const [celebrationLevelUp, setCelebrationLevelUp] = useState(false)
  const [achievementQueue, setAchievementQueue] = useState<AchievementData[]>([])
  const [currentAchievement, setCurrentAchievement] = useState<AchievementData | null>(null)
  const practicedWordIds = useRef<number[]>([])

  const setupLetters = (letters: string[], letterCount: number) => {
    const tiles = letters.map((char, id) => ({ id, char }))
    setAvailable(tiles)
    setSlots(Array(letterCount).fill(null))
  }

  const loadNext = useCallback(async (review = reviewMode) => {
    if (!childId) return
    setLoading(true)
    setError('')
    setNeedLearnFirst(false)
    setFeedback(null)
    setCorrectAnswer('')
    setSubmitting(false)
    setFinished(false)
    setSpeakText('')
    setAvailable([])
    setSlots([])
    try {
      const id = Number(childId)
      const [p, pool, learned] = await Promise.all([
        api.dailyPlans.today(id),
        api.children.wordPool(id),
        api.children.learnedWords(id),
      ])
      setPlan(p)
      setPoolSize(pool.length)

      const next = await pickNextWord(
        id,
        'spelling',
        [],
        p,
        practicedWordIds.current,
        learned.word_ids,
        { review },
      )
      if (!next) {
        if (!review && learned.word_ids.length === 0 && pool.length > 0) {
          setNeedLearnFirst(true)
        }
        setFinished(true)
        return
      }
      const activeReview = review || !!next.review
      const itemId = activeReview ? undefined : next.planItemId
      const quiz = await api.learning.spellingQuiz(id, next.wordId, itemId)
      setSpeakText(quiz.word_en)
      setWordId(quiz.word_id)
      setPlanItemId(itemId)
      setMeaning(quiz.meaning_zh)
      setPromptType(quiz.prompt_type === 'meaning' ? 'meaning' : 'listen')
      setupLetters(quiz.letters, quiz.letter_count)
      setStartTime(Date.now())
      setTimeout(() => speakWord(quiz.word_en), 300)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败'
      if (msg.includes('学一学')) {
        setNeedLearnFirst(true)
        setFinished(true)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [childId, reviewMode])

  useEffect(() => { loadNext() }, [loadNext])

  useEffect(() => {
    if (achievementQueue.length > 0 && !currentAchievement) {
      setCurrentAchievement(achievementQueue[0])
      setAchievementQueue((q) => q.slice(1))
    }
  }, [achievementQueue, currentAchievement])

  const startReview = () => {
    practicedWordIds.current = []
    setSessionDone(0)
    setReviewMode(true)
    loadNext(true)
  }

  const triggerCelebration = (gamification: GamificationData) => {
    setCelebrationXp(gamification.xp_earned)
    setCelebrationLevelUp(gamification.level_up)
    setShowCelebration(true)
    if (gamification.new_achievements.length > 0) {
      setAchievementQueue((q) => [...q, ...gamification.new_achievements])
    }
  }

  const placeTile = (tile: LetterTile) => {
    if (feedback || submitting) return
    const idx = slots.findIndex((s) => s === null)
    if (idx === -1) return
    setAvailable((prev) => prev.filter((t) => t.id !== tile.id))
    setSlots((prev) => {
      const next = [...prev]
      next[idx] = tile
      return next
    })
  }

  const removeFromSlot = (slotIdx: number) => {
    if (feedback || submitting) return
    const tile = slots[slotIdx]
    if (!tile) return
    setSlots((prev) => {
      const next = [...prev]
      next[slotIdx] = null
      return next
    })
    setAvailable((prev) => [...prev, tile].sort((a, b) => a.id - b.id))
  }

  const handleSubmit = async () => {
    if (feedback || submitting || loading || !childId) return
    if (slots.some((s) => s === null)) return
    setSubmitting(true)
    const spelling = slots.map((s) => s!.char).join('')
    try {
      const res = await api.learning.spellingCheck({
        child_id: Number(childId),
        word_id: wordId,
        spelling,
        plan_item_id: reviewMode ? undefined : planItemId,
        duration_ms: Date.now() - startTime,
      })
      setCorrectAnswer(res.correct_answer)
      setFeedback(res.is_correct ? 'correct' : 'wrong')
      if (res.is_correct) {
        playCorrectSound()
        triggerCelebration(res.gamification)
        setTimeout(async () => {
          practicedWordIds.current = [...practicedWordIds.current, wordId]
          setSessionDone((n) => n + 1)
          setShowCelebration(false)
          await loadNext(reviewMode)
        }, 2000)
      } else {
        playWrongSound()
        setTimeout(() => {
          setFeedback(null)
          setCorrectAnswer('')
          setSubmitting(false)
        }, 1500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败')
      setSubmitting(false)
    }
  }

  const allFilled = slots.length > 0 && slots.every((s) => s !== null)
  const progress = moduleProgressLabel(plan, 'spelling', poolSize, sessionDone, reviewMode)

  if (!childId) return null

  return (
    <ModuleShell
      config={config}
      progress={progress}
      onBack={() => goToModuleHome(childId, navigate)}
    >
      <CelebrationOverlay
        xpEarned={celebrationXp}
        levelUp={celebrationLevelUp}
        show={showCelebration}
        onDone={() => setShowCelebration(false)}
      />
      <AchievementToast
        achievement={currentAchievement}
        onDone={() => setCurrentAchievement(null)}
      />

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="text-xl text-red-500 mb-6">{error}</p>
          <KidButton color="green" onClick={loadNext}>重试</KidButton>
        </div>
      ) : finished ? (
        <motion.div
          className="flex-1 flex flex-col items-center justify-center p-8 text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <motion.span className="text-9xl mb-6">
            {needLearnFirst ? '📖' : '🌟'}
          </motion.span>
          {needLearnFirst ? (
            <>
              <h2 className="text-3xl font-bold text-emerald-600 mb-2">先去学一学吧！</h2>
              <p className="text-lg text-slate-500 mb-6">认识单词之后，再来拼一拼挑战</p>
              <KidButton color="green" onClick={() => navigate(`/learn/${childId}/learn`)}>
                去学一学
              </KidButton>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-emerald-600 mb-2">拼一拼完成啦！</h2>
              <p className="text-lg text-slate-500 mb-6">想再练一练？可以复习哦</p>
              <div className="w-full max-w-xs flex flex-col gap-3">
                <KidButton color="green" onClick={startReview}>
                  再复习一遍 🔄
                </KidButton>
                <KidButton color="blue" size="md" onClick={() => goToModuleHome(childId, navigate)}>
                  返回首页
                </KidButton>
              </div>
            </>
          )}
        </motion.div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <motion.span
            className="text-7xl"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            ✏️
          </motion.span>
        </div>
      ) : (
        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {feedback === 'correct' && (
              <motion.span
                key="correct"
                className="text-8xl mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, 15, -15, 0] }}
                exit={{ scale: 0 }}
              >
                🌟
              </motion.span>
            )}
            {feedback === 'wrong' && (
              <motion.div key="wrong" className="mb-4 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className="text-6xl">💪</span>
                {correctAnswer && (
                  <p className="text-xl text-slate-500 mt-2">正确拼写：<span className="font-bold text-emerald-600">{correctAnswer}</span></p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {promptType === 'meaning' && meaning ? (
            <div className="mb-5 text-center">
              <p className="text-5xl font-extrabold text-emerald-600">{meaning}</p>
              <p className="text-lg text-slate-400 mt-2">把字母拼成英文单词</p>
            </div>
          ) : (
            <div className="mb-5 text-center">
              <p className="text-4xl font-bold text-emerald-600">👂 听一听</p>
              <p className="text-lg text-slate-400 mt-2">把听到的单词拼出来</p>
            </div>
          )}

          <motion.button
            onClick={() => speakWord(speakText)}
            className="mb-6 p-5 bg-white rounded-full shadow-xl"
            whileTap={{ scale: 0.9 }}
          >
            <span className="text-5xl">🔊</span>
          </motion.button>

          <div className="mb-6 flex flex-wrap justify-center gap-2 max-w-lg">
            {slots.map((tile, idx) => (
              <motion.button
                key={idx}
                onClick={() => removeFromSlot(idx)}
                disabled={!!feedback || submitting || !tile}
                className="w-14 h-16 rounded-2xl border-3 border-dashed border-emerald-300 bg-white flex items-center justify-center text-2xl font-bold text-emerald-700 disabled:opacity-60"
                whileTap={{ scale: 0.9 }}
                layout
              >
                {tile?.char ?? ''}
              </motion.button>
            ))}
          </div>

          <div className="w-full max-w-lg flex flex-wrap justify-center gap-2 mb-6">
            <AnimatePresence>
              {available.map((tile) => (
                <motion.button
                  key={tile.id}
                  onClick={() => placeTile(tile)}
                  disabled={!!feedback || submitting}
                  className="w-14 h-16 bg-white rounded-2xl text-2xl font-bold shadow-md border-3 border-emerald-100 disabled:opacity-60"
                  whileTap={{ scale: 0.85 }}
                  layout
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  {tile.char}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          <KidButton
            color="green"
            onClick={handleSubmit}
            disabled={!allFilled || !!feedback || submitting}
          >
            {submitting ? '提交中…' : '拼好了！'}
          </KidButton>
        </div>
      )}
    </ModuleShell>
  )
}
