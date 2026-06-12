import { motion } from 'framer-motion'

interface XPBarProps {
  xp: number
  xpToNext: number
  level: number
}

export function XPBar({ xp, xpToNext, level }: XPBarProps) {
  const levelThreshold = level * 100
  const xpInLevel = xp - ((level - 1) * 100)
  const levelSize = levelThreshold > 0 ? levelThreshold : 100
  const percent = Math.min(Math.max((xpInLevel / levelSize) * 100, 0), 100)

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-extrabold text-lg shrink-0 shadow-sm">
        {level}
      </div>

      <div className="relative flex-1 h-5 rounded-full bg-gray-200/80 overflow-hidden shadow-inner">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 15 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white drop-shadow-sm">
            还差 {xpToNext} XP 升级
          </span>
        </div>
      </div>

      <span className="text-sm font-bold text-purple-600 shrink-0">{xp} XP</span>
    </div>
  )
}
