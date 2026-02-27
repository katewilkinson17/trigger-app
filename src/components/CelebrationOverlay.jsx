import { useMemo } from 'react'

const CONFETTI_COLORS = ['#5B4FE8', '#2EA87E', '#D9A225', '#E84F4F', '#A78BFA', '#34D399']

function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 48 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.5,
      size: 7 + Math.random() * 8,
      isCircle: i % 3 === 0,
    })),
    []
  )
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.x}%`,
            background: p.color,
            width: p.size,
            height: p.isCircle ? p.size : p.size * 0.45,
            borderRadius: p.isCircle ? '50%' : 2,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function CelebrationOverlay({ taskText }) {
  return (
    <div className="do-overlay">
      <Confetti />
      <div className="do-celebrate">
        <span className="do-celebrate-icon">🎉</span>
        <p className="do-celebrate-msg">Nice work!</p>
        {taskText && <p className="do-celebrate-task">{taskText}</p>}
      </div>
    </div>
  )
}
