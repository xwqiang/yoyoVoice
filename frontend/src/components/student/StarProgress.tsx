export function StarProgress({ stars, total = 5 }: { stars: number; total?: number }) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`text-4xl ${i < stars ? '' : 'opacity-25'}`}>
          ⭐
        </span>
      ))}
    </div>
  )
}
