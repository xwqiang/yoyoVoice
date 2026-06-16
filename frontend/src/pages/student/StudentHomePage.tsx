import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../../api/client'
import { ModuleCard } from '../../components/student/ModuleCard'
import { XPBar } from '../../components/student/XPBar'
import { LevelBadge } from '../../components/student/LevelBadge'
import { StreakFire } from '../../components/student/StreakFire'
import { moduleProgress, LEARN_MODULE, ASSESSMENT_MODULES } from '../../utils/moduleHelpers'
import type { Child, ChildStats, DailyPlan } from '../../types'

export function StudentHomePage() {
  const { childId } = useParams<{ childId: string }>()
  const navigate = useNavigate()
  const [child, setChild] = useState<Child | null>(null)
  const [stats, setStats] = useState<ChildStats | null>(null)
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [poolSize, setPoolSize] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    setError('')
    try {
      const id = Number(childId)
      const [c, s, p, pool] = await Promise.all([
        api.children.get(id),
        api.children.stats(id),
        api.dailyPlans.today(id),
        api.children.wordPool(id),
      ])
      setChild(c)
      setStats(s)
      setPlan(p)
      setPoolSize(pool.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.span
          className="text-7xl"
          animate={{ y: [0, -20, 0] }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          📚
        </motion.span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <p className="text-xl text-red-500 mb-6">{error}</p>
        <button onClick={load} className="text-lg text-violet-500 font-bold">重试</button>
      </div>
    )
  }

  const allDone = plan && plan.total > 0 && plan.completed >= plan.total

  return (
    <div className="min-h-screen flex flex-col p-6 pb-10">
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-center gap-4 mb-3">
          <motion.span
            className="text-6xl"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          >
            {child?.avatar_emoji ?? '😊'}
          </motion.span>
          <div className="text-left">
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              你好，{child?.nickname ?? '小朋友'}！
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <LevelBadge level={stats?.level ?? 1} size="sm" />
              <StreakFire days={stats?.streak_days ?? 0} />
            </div>
          </div>
        </div>

        {stats && (
          <motion.div
            className="max-w-sm mx-auto mt-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <XPBar xp={stats.xp} xpToNext={stats.xp_to_next} level={stats.level} />
          </motion.div>
        )}

        {plan && plan.total > 0 ? (
          <motion.p
            className="text-lg text-slate-500 mt-4 font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {allDone ? '今天全部完成啦 🎉 太棒了！' : `今日任务 ${plan.completed}/${plan.total}`}
          </motion.p>
        ) : poolSize > 0 ? (
          <p className="text-lg text-slate-500 mt-4">先学一学，再挑战认一认、拼一拼、读一读</p>
        ) : (
          <p className="text-lg text-amber-600 mt-4 font-medium">还没有单词，叫爸爸妈妈帮你添加吧</p>
        )}
      </motion.div>

      <div className="flex-1 flex flex-col gap-5 max-w-lg mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ModuleCard
            config={LEARN_MODULE}
            completed={moduleProgress(plan, 'learn').completed}
            total={moduleProgress(plan, 'learn').total}
            poolSize={poolSize}
            onClick={() => navigate(`/learn/${childId}/learn`)}
          />
        </motion.div>

        <p className="text-center text-sm font-bold text-slate-400 tracking-wide">— 挑战考核 —</p>

        {ASSESSMENT_MODULES.map((mod, index) => {
          const { total, completed } = moduleProgress(plan, mod.type)
          return (
            <motion.div
              key={mod.type}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + index * 0.15 }}
            >
              <ModuleCard
                config={mod}
                completed={completed}
                total={total}
                poolSize={poolSize}
                onClick={() => navigate(`/learn/${childId}/${mod.type}`)}
              />
            </motion.div>
          )
        })}
      </div>

      <motion.button
        onClick={() => navigate('/learn')}
        className="mt-10 text-lg text-violet-400 text-center font-medium"
        whileTap={{ scale: 0.95 }}
      >
        换一个小朋友
      </motion.button>
    </div>
  )
}
