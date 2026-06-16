import { motion } from 'framer-motion'
import type { ModuleConfig } from '../../utils/moduleHelpers'

interface ModuleCardProps {
  config: ModuleConfig
  completed: number
  total: number
  poolSize?: number
  onClick: () => void
}

const MODULE_GRADIENTS: Record<string, string> = {
  learn: 'from-sky-400 to-blue-600',
  meaning: 'from-violet-400 to-purple-600',
  spelling: 'from-emerald-400 to-teal-600',
  pronunciation: 'from-amber-400 to-orange-500',
}

const RING_COLORS: Record<string, string> = {
  learn: '#0ea5e9',
  meaning: '#8b5cf6',
  spelling: '#10b981',
  pronunciation: '#f59e0b',
}

function MasteryRing({ progress, color, size = 64 }: { progress: number; color: string; size?: number }) {
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - progress * circumference

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="white"
        strokeWidth={stroke}
        opacity={0.3}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
      />
    </svg>
  )
}

export function ModuleCard({ config, completed, total, poolSize = 0, onClick }: ModuleCardProps) {
  const hasPlan = total > 0
  const done = hasPlan && completed >= total
  const displayTotal = hasPlan ? total : poolSize
  const progress = displayTotal > 0 ? Math.min((hasPlan ? completed : 0) / displayTotal, 1) : 0
  const ringColor = RING_COLORS[config.type] ?? '#8b5cf6'
  const gradient = MODULE_GRADIENTS[config.type] ?? 'from-violet-400 to-purple-600'

  const statusLabel = hasPlan
    ? done ? '✅ 完成!' : `${completed}/${total}`
    : poolSize > 0 ? `${poolSize} 词` : '—'

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      animate={{ y: [0, -6, 0] }}
      transition={{
        y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        scale: { type: 'spring', stiffness: 400, damping: 17 },
      }}
      className={`
        relative w-full p-7 rounded-[2rem] text-left overflow-hidden
        bg-gradient-to-br ${gradient}
        shadow-xl shadow-black/10
        ring-2 ring-white/30
      `}
    >
      {/* shimmer overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 4 }}
        style={{ width: '50%' }}
      />

      <div className="relative flex items-center gap-5">
        <span className="text-7xl shrink-0 drop-shadow-lg">{config.emoji}</span>

        <div className="flex-1 min-w-0">
          <h2 className="text-3xl font-extrabold text-white drop-shadow-sm">{config.label}</h2>
          <p className="text-lg text-white/80 mt-1">{config.subtitle}</p>
        </div>

        <div className="relative flex items-center justify-center shrink-0">
          <MasteryRing progress={progress} color={ringColor} />
          <span className="absolute text-xs font-bold text-white">{statusLabel}</span>
        </div>
      </div>
    </motion.button>
  )
}
