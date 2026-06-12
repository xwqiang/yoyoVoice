import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../../api/client'
import { ModuleShell } from '../../components/student/ModuleShell'
import { KidButton } from '../../components/student/KidButton'
import { TeachingCard } from '../../components/student/TeachingCard'
import { CelebrationOverlay } from '../../components/student/CelebrationOverlay'
import { AchievementToast } from '../../components/student/AchievementToast'
import {
  goToModuleHome,
  moduleProgressLabel,
  pickNextWord,
  STUDENT_MODULES,
} from '../../utils/moduleHelpers'
import { speakWord } from '../../utils/studentNav'
import { playCorrectSound, playWrongSound } from '../../utils/sounds'
import type { AchievementData, DailyPlan, GamificationData } from '../../types'

const ENCOURAGEMENTS = ['加油！你可以的 💪', '再想想看～', '差一点点！', '没关系，再试一次']

export function MeaningModule() {
  const { childId } = useParams<{ childId: string }>()
  const navigate = useNavigate()
  const config = STUDENT_MODULES[0]

  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [poolSize, setPoolSize] = useState(0)
  const [sessionDone, setSessionDone] = useState(0)
  const [wordEn, setWordEn] = useState('')
  const [wordId, setWordId] = useState(0)
  const [planItemId, setPlanItemId] = useState<number | undefined>()
  const [options, setOptions] = useState<string[]>([])
  const [quizType, setQuizType] = useState<'meaning' | 'recognition'>('meaning')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')
  const [startTime, setStartTime] = useState(Date.now())

  const [showTeaching, setShowTeaching] = useState(false)
  const [teachingData, setTeachingData] = useState<{
    wordEn: string; meaningZh: string | null; phonetic: string | null; exampleSentence: string | null
  } | null>(null)

  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationXp, setCelebrationXp] = useState(0)
  const [celebrationLevelUp, setCelebrationLevelUp] = useState(false)
  const [achievementQueue, setAchievementQueue] = useState<AchievementData[]>([])
  const [currentAchievement, setCurrentAchievement] = useState<AchievementData | null>(null)

  const loadNext = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    setError('')
    setFeedback(null)
    setSubmitting(false)
    setFinished(false)
    setShowTeaching(false)
    setTeachingData(null)
    setWordEn('')
    setOptions([])
    try {
      const id = Number(childId)
      const [p, pool] = await Promise.all([
        api.dailyPlans.today(id),
        api.children.wordPool(id),
      ])
      setPlan(p)
      setPoolSize(pool.length)

      const next = await pickNextWord(id, 'meaning', [], p)
      if (!next) {
        setFinished(true)
        return
      }
      const quiz = await api.learning.meaningQuiz(id, next.wordId, next.planItemId)
      setWordEn(quiz.word_en)
      setWordId(quiz.word_id)
      setPlanItemId(next.planItemId)
      setOptions(quiz.options)
      setQuizType(quiz.quiz_type === 'recognition' ? 'recognition' : 'meaning')

      if (quiz.needs_teaching) {
        setTeachingData({
          wordEn: quiz.word_en,
          meaningZh: quiz.meaning_zh,
          phonetic: quiz.phonetic,
          exampleSentence: quiz.example_sentence,
        })
        setShowTeaching(true)
      } else {
        setStartTime(Date.now())
        setTimeout(() => speakWord(quiz.word_en), 300)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => { loadNext() }, [loadNext])

  useEffect(() => {
    if (achievementQueue.length > 0 && !currentAchievement) {
      setCurrentAchievement(achievementQueue[0])
      setAchievementQueue((q) => q.slice(1))
    }
  }, [achievementQueue, currentAchievement])

  const handleTeachingDone = () => {
    setShowTeaching(false)
    setStartTime(Date.now())
    setTimeout(() => speakWord(wordEn), 200)
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
        plan_item_id: planItemId,
        duration_ms: Date.now() - startTime,
      })
      setFeedback(res.is_correct ? 'correct' : 'wrong')
      if (res.is_correct) {
        playCorrectSound()
        triggerCelebration(res.gamification)
        setTimeout(async () => {
          setSessionDone((n) => n + 1)
          setShowCelebration(false)
          await loadNext()
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

  const progress = moduleProgressLabel(plan, 'meaning', poolSize, sessionDone)

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

      {showTeaching && teachingData ? (
        <TeachingCard
          wordEn={teachingData.wordEn}
          meaningZh={teachingData.meaningZh}
          phonetic={teachingData.phonetic}
          exampleSentence={teachingData.exampleSentence}
          onDone={handleTeachingDone}
        />
      ) : error ? (
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
          <motion.span
            className="text-9xl mb-6"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            🌟
          </motion.span>
          <h2 className="text-3xl font-bold text-violet-600 mb-4">认一认完成啦！</h2>
          <KidButton color="purple" onClick={() => goToModuleHome(childId, navigate)}>
            返回首页
          </KidButton>
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

          {quizType === 'recognition' ? (
            <p className="text-4xl font-bold text-violet-400 mb-6">听一听 👂</p>
          ) : (
            <motion.p
              className="text-5xl font-extrabold text-violet-600 mb-6"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              key={wordEn}
            >
              {wordEn}
            </motion.p>
          )}

          <motion.button
            onClick={() => speakWord(wordEn)}
            className="mb-8 p-5 bg-white rounded-full shadow-xl"
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-5xl">🔊</span>
          </motion.button>

          <p className="text-xl text-violet-500 font-bold mb-6">
            {quizType === 'recognition' ? '点出你听到的单词' : '点出它的意思'}
          </p>

          <div className="w-full max-w-lg grid grid-cols-1 gap-3">
            {options.map((opt, i) => (
              <motion.button
                key={opt}
                onClick={() => handlePick(opt)}
                disabled={!!feedback || submitting}
                className="min-h-[4.5rem] px-6 py-4 bg-white rounded-3xl text-xl font-bold shadow-md border-3 border-violet-100 disabled:opacity-60"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                whileTap={{ scale: 0.95 }}
              >
                {opt}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </ModuleShell>
  )
}
