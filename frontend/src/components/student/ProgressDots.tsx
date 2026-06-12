import { motion } from 'framer-motion'

interface ProgressDotsProps {
  total: number
  completed: number
  color?: string
  label?: string
}

export function ProgressDots({ total, completed, color = '#8b5cf6', label }: ProgressDotsProps) {
  const displayCount = Math.min(total, 20)

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <p className="text-sm font-medium text-slate-500">{label}</p>}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {Array.from({ length: displayCount }).map((_, i) => {
          const filled = i < completed
          return (
            <motion.div
              key={i}
              className="w-3 h-3 rounded-full border-2"
              style={{
                backgroundColor: filled ? color : 'transparent',
                borderColor: filled ? color : '#d1d5db',
              }}
              initial={false}
              animate={filled ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: i * 0.03 }}
            />
          )
        })}
        {total > 20 && (
          <span className="text-xs text-slate-400 ml-1">{completed}/{total}</span>
        )}
      </div>
    </div>
  )
}
