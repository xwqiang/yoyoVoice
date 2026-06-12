import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { ModuleConfig } from '../../utils/moduleHelpers'
import { ProgressDots } from './ProgressDots'

interface ModuleShellProps {
  config: ModuleConfig
  progress: { completed: number; total: number; label: string }
  onBack: () => void
  children: ReactNode
}

export function ModuleShell({ config, progress, onBack, children }: ModuleShellProps) {
  return (
    <motion.div
      className="min-h-screen flex flex-col"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <header className="px-5 pt-4 pb-4 bg-white/60 backdrop-blur-xl border-b border-white/30">
        <div className="flex items-center justify-between mb-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="min-h-14 px-6 bg-white/90 rounded-2xl text-xl font-bold text-violet-500 shadow-md"
          >
            ← 返回
          </motion.button>
          <p className="text-2xl font-bold text-slate-700">
            {config.emoji} {config.label}
          </p>
          <div className="w-24" />
        </div>
        <ProgressDots completed={progress.completed} total={progress.total} label={progress.label} />
      </header>

      <motion.main className="flex-1 flex flex-col" layout>
        {children}
      </motion.main>
    </motion.div>
  )
}
