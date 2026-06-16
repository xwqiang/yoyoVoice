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

const ENCOURAGEMENTS = ['加油！你可以的 💪', '再想想看～', '差一点点！', '没关系，再试一次']

export function MeaningModule() {
  const { childId } = useParams<{ childId: string }>()
  const navigate = useNavigate()
  const config = getModuleConfig('meaning')

  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [poolSize, setPoolSize] = useState(0)
  const [sessionDone, setSessionDone] = useState(0)
  const [wordEn, setWordEn] = useState('')
  const [meaningZh, setMeaningZh] = useState<string | null>(null)
  const [phonetic, setPhonetic] = useState<string | null>(null)
  const [wordId, setWordId] = useState(0)
  const [planItemId, setPlanItemId] = useState<number | undefined>()
  const [options, setOptions] = useState<string[]>([])
  const [quizType, setQuizType] = useState<'meaning' | 'recognition'>('meaning')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
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

  const loadNext = useCallback(async (review = reviewMode) => {
    if (!childId) return
    setLoading(true)
    setError('')
    setNeedLearnFirst(false)
    setFeedback(null)
    setSubmitting(false)
    setFinished(false)
    setWordEn('')
    setMeaningZh(null)
    setPhonetic(null)
    setOptions([])
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
        'meaning',
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
      const quiz = await api.learning.meaningQuiz(id, next.wordId, itemId)
      setWordEn(quiz.word_en)
      setMeaningZh(quiz.meaning_zh)
      setPhonetic(quiz.phonetic)
      setWordId(quiz.word_id)
      setPlanItemId(itemId)
      setOptions(quiz.options)
      setQuizType(quiz.quiz_type === 'recognition' ? 'recognition' : 'meaning')
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

  const handlePick = async (option: string) => {
    if (feedback || submitting || loading || !childId) return
    setSubmitting(true)
    try {
      const res = await api.learning.meaningCheck({
        child_id: Number(childId),
        word_id: wordId,
        selected_meaning: option,
        plan_item_id: reviewMode ? undefined : planItemId,
        duration_ms: Date.now() - startTime,
      })
      setFeedback(res.is_correct ? 'correct' : 'wrong')
      if (res.is_correct) {
        playCorrectSound()
        speakWord(wordEn)
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
          setSubmitting(false)
        }, 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败')
      setSubmitting(false)
    }
  }

  const progress = moduleProgressLabel(plan, 'meaning', poolSize, sessionDone, reviewMode)

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
          <KidButton color="purple" onClick={loadNext}>重试</KidButton>
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
              <h2 className="text-3xl font-bold text-violet-600 mb-2">先去学一学吧！</h2>
              <p className="text-lg text-slate-500 mb-6">认识单词之后，再来认一认挑战</p>
              <KidButton color="purple" onClick={() => navigate(`/learn/${childId}/learn`)}>
                去学一学
              </KidButton>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-violet-600 mb-2">认一认完成啦！</h2>
              <p className="text-lg text-slate-500 mb-6">想再练一练？可以复习哦</p>
              <div className="w-full max-w-xs flex flex-col gap-3">
                <KidButton color="purple" onClick={startReview}>
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
            👂
          </motion.span>
        </div>
      ) : (
        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {feedback === 'correct' && (
              <motion.div
                key="correct"
                className="mb-6 text-center"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
              >
                <motion.span
                  className="text-6xl block mb-3"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  🌟
                </motion.span>
                <p className="text-5xl font-extrabold text-violet-600 mb-2">{wordEn}</p>
                {phonetic && (
                  <p className="text-xl text-indigo-400 mb-1">{phonetic}</p>
                )}
                {meaningZh && (
                  <p className="text-2xl font-bold text-slate-700">{meaningZh}</p>
                )}
              </motion.div>
            )}
            {feedback === 'wrong' && (
              <motion.p
                key="wrong"
                className="text-2xl text-amber-600 font-bold mb-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]}
              </motion.p>
            )}
          </AnimatePresence>

          {feedback !== 'correct' && (
            <>
              <motion.p
                className="text-4xl font-bold text-violet-400 mb-6"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                key={wordId}
              >
                听一听 👂
              </motion.p>

              <motion.button
                onClick={() => speakWord(wordEn)}
                className="mb-8 p-5 bg-white rounded-full shadow-xl"
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
              >
                <span className="text-5xl">🔊</span>
              </motion.button>
            </>
          )}

          {feedback !== 'correct' && (
            <p className="text-xl text-violet-500 font-bold mb-6">
              {quizType === 'recognition' ? '点出你听到的单词' : '点出它的意思'}
            </p>
          )}

          {feedback === 'correct' && (
            <motion.button
              onClick={() => speakWord(wordEn)}
              className="mb-8 p-5 bg-white rounded-full shadow-xl"
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span className="text-5xl">🔊</span>
            </motion.button>
          )}

          <div className="w-full max-w-lg grid grid-cols-1 gap-3">
            {options.map((opt, i) => {
              const isCorrectOption =
                feedback === 'correct' &&
                (quizType === 'recognition' ? opt === wordEn : opt === meaningZh)
              return (
              <motion.button
                key={opt}
                onClick={() => handlePick(opt)}
                disabled={!!feedback || submitting}
                className={`min-h-[4.5rem] px-6 py-4 rounded-3xl text-xl font-bold shadow-md border-3 disabled:opacity-60 ${
                  isCorrectOption
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                    : 'bg-white border-violet-100'
                }`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                whileTap={{ scale: 0.95 }}
              >
                {opt}
              </motion.button>
            )})}
          </div>
        </div>
      )}
    </ModuleShell>
  )
}
