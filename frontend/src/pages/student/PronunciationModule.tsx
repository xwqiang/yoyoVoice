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
import { micErrorMessage, HoldToRecordSession } from '../../utils/audioRecording'
import { speakWord } from '../../utils/studentNav'
import { playCorrectSound, playWrongSound } from '../../utils/sounds'
import type { AchievementData, DailyPlan, GamificationData } from '../../types'

function scoreToStars(score: number): number {
  if (score >= 85) return 3
  if (score >= 60) return 2
  if (score > 0) return 1
  return 0
}

export function PronunciationModule() {
  const { childId } = useParams<{ childId: string }>()
  const navigate = useNavigate()
  const config = getModuleConfig('pronunciation')

  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [poolSize, setPoolSize] = useState(0)
  const [sessionDone, setSessionDone] = useState(0)
  const [wordEn, setWordEn] = useState('')
  const [meaningZh, setMeaningZh] = useState('')
  const [wordId, setWordId] = useState(0)
  const [planItemId, setPlanItemId] = useState<number | undefined>()
  const [recording, setRecording] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stars, setStars] = useState<number | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [finished, setFinished] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [error, setError] = useState('')
  const [needLearnFirst, setNeedLearnFirst] = useState(false)

  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationXp, setCelebrationXp] = useState(0)
  const [celebrationLevelUp, setCelebrationLevelUp] = useState(false)
  const [achievementQueue, setAchievementQueue] = useState<AchievementData[]>([])
  const [currentAchievement, setCurrentAchievement] = useState<AchievementData | null>(null)
  const practicedWordIds = useRef<number[]>([])
  const recordSessionRef = useRef<HoldToRecordSession | null>(null)
  const holdingRef = useRef(false)

  const loadNext = useCallback(async (review = reviewMode) => {
    if (!childId) return
    setLoading(true)
    setError('')
    setNeedLearnFirst(false)
    setStars(null)
    setScore(null)
    setFeedback('')
    setSubmitting(false)
    setFinished(false)
    setWordEn('')
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
        'pronunciation',
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
      const quiz = await api.learning.pronunciationQuiz(id, next.wordId, itemId)
      setWordEn(quiz.word_en)
      setMeaningZh(quiz.meaning_zh)
      setWordId(quiz.word_id)
      setPlanItemId(itemId)
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

  const finishRecording = async () => {
    const session = recordSessionRef.current
    if (!session || !holdingRef.current) return
    holdingRef.current = false
    recordSessionRef.current = null
    setRecording(false)
    try {
      const { blob, ext, durationMs } = await session.end()
      await submitAudio(blob, ext, durationMs)
    } catch (err) {
      setError(err instanceof Error ? err.message : '录音失败，再试一次吧')
      setSubmitting(false)
    }
  }

  const handlePointerDown = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (recording || submitting || loading || stars !== null) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setError('')
    setStars(null)
    setScore(null)
    setFeedback('')
    holdingRef.current = true
    setRecording(true)
    try {
      const session = new HoldToRecordSession()
      recordSessionRef.current = session
      await session.begin(8000, () => { void finishRecording() })
    } catch (err) {
      holdingRef.current = false
      recordSessionRef.current = null
      setRecording(false)
      setError(micErrorMessage(err))
    }
  }

  const handlePointerUp = () => {
    void finishRecording()
  }

  const handlePointerCancel = () => {
    if (!holdingRef.current) return
    holdingRef.current = false
    recordSessionRef.current?.cancel()
    recordSessionRef.current = null
    setRecording(false)
    setError('录音已取消，按住按钮再试一次')
  }

  const submitAudio = async (blob: Blob, ext: string, durationMs: number) => {
    if (!childId) return
    setSubmitting(true)
    const form = new FormData()
    form.append('child_id', String(childId))
    form.append('word_id', String(wordId))
    if (planItemId && !reviewMode) form.append('plan_item_id', String(planItemId))
    form.append('duration_ms', String(durationMs))
    form.append('audio', blob, `recording.${ext}`)

    try {
      const data = await api.learning.pronunciationCheck(form)
      const s = scoreToStars(data.pronunciation_score)
      setStars(s)
      setScore(Math.round(data.pronunciation_score))
      setFeedback(data.message)
      if (s >= 2) {
        playCorrectSound()
        triggerCelebration(data.gamification)
        practicedWordIds.current = [...practicedWordIds.current, wordId]
        setSessionDone((n) => n + 1)
        setTimeout(() => {
          setShowCelebration(false)
          loadNext(reviewMode)
        }, 2000)
      } else {
        playWrongSound()
        setSubmitting(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '再试一次吧')
      setSubmitting(false)
    }
  }

  const progress = moduleProgressLabel(plan, 'pronunciation', poolSize, sessionDone, reviewMode)

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

      {error && !finished && !loading ? (
        <p className="text-center text-xl text-amber-600 px-6 pt-4">{error}</p>
      ) : null}

      {finished ? (
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
              <h2 className="text-3xl font-bold text-amber-600 mb-2">先去学一学吧！</h2>
              <p className="text-lg text-slate-500 mb-6">认识单词之后，再来读一读挑战</p>
              <KidButton color="orange" onClick={() => navigate(`/learn/${childId}/learn`)}>
                去学一学
              </KidButton>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-amber-600 mb-2">读一读完成啦！</h2>
              <p className="text-lg text-slate-500 mb-6">想再练一练？可以复习哦</p>
              <div className="w-full max-w-xs flex flex-col gap-3">
                <KidButton color="orange" onClick={startReview}>
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
                🎤
              </motion.span>
            </div>
          ) : (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
              <motion.p
                className="text-5xl font-extrabold text-violet-600 mb-2"
                key={wordEn}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {wordEn}
              </motion.p>
              {meaningZh && <p className="text-2xl text-slate-500 mb-6">{meaningZh}</p>}

              <motion.button
                onClick={() => speakWord(wordEn)}
                className="mb-6 p-5 bg-white rounded-full shadow-xl"
                whileTap={{ scale: 0.9 }}
              >
                <span className="text-5xl">🔊</span>
              </motion.button>

              <p className="text-xl text-violet-500 font-bold mb-6">按住说话，松开提交</p>

              <AnimatePresence mode="wait">
                {stars !== null ? (
                  <motion.div
                    key="stars"
                    className="mb-6"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <div className="flex justify-center gap-3 text-5xl mb-3">
                      {[1, 2, 3].map((i) => (
                        <motion.span
                          key={i}
                          className={i <= stars ? '' : 'opacity-20'}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: i * 0.15 }}
                        >
                          ⭐
                        </motion.span>
                      ))}
                    </div>
                    {score !== null && (
                      <p className="text-2xl font-bold text-slate-600 mb-2">{score} 分</p>
                    )}
                    {feedback && (
                      <p className="text-lg text-violet-600 mb-4 px-4">{feedback}</p>
                    )}
                    {stars < 2 && (
                      <KidButton
                        color="orange"
                        onClick={() => {
                          setStars(null)
                          setScore(null)
                          setFeedback('')
                          setError('')
                          setSubmitting(false)
                        }}
                      >
                        再试一次 🎤
                      </KidButton>
                    )}
                  </motion.div>
                ) : (
                  <motion.button
                    key="record"
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    disabled={submitting}
                    className={`w-36 h-36 rounded-full flex items-center justify-center shadow-2xl transition-transform select-none touch-none ${
                      recording ? 'bg-red-400' : 'bg-gradient-to-br from-violet-500 to-indigo-600'
                    } disabled:opacity-60`}
                    animate={recording ? { scale: [1, 1.1, 1] } : {}}
                    transition={recording ? { repeat: Infinity, duration: 0.8 } : {}}
                  >
                    <span className="text-6xl">{recording ? '🔴' : '🎤'}</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
    </ModuleShell>
  )
}
