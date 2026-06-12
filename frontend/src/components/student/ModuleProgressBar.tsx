interface ModuleProgressBarProps {
  completed: number
  total: number
  color?: string
  label?: string
}

export function ModuleProgressBar({
  completed,
  total,
  color = 'bg-violet-500',
  label,
}: ModuleProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0

  return (
    <div className="w-full">
      {label && <p className="text-sm text-slate-500 mb-1.5">{label}</p>}
      <div className="h-3 bg-white/70 rounded-full overflow-hidden shadow-inner">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm font-semibold text-slate-500 mt-1.5 text-right">
        {total > 0 ? `${completed} / ${total}` : '暂无任务'}
      </p>
    </div>
  )
}
