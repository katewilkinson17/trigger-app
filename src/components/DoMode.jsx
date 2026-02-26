import { useState, useEffect, useRef, useMemo } from 'react'

const DURATION_SECS = {
  under5:   5 * 60,
  '5to15': 15 * 60,
  '15to30':30 * 60,
  longer:  25 * 60, // Pomodoro cap
}

const RADIUS = 80
const CIRC = 2 * Math.PI * RADIUS

const CONFETTI_COLORS = ['#5B4FE8', '#2EA87E', '#D9A225', '#E84F4F', '#A78BFA', '#34D399']

function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ringColor(progress) {
  if (progress > 0.5) return 'var(--accent)'
  if (progress > 0.25) return 'var(--yellow)'
  return 'var(--red)'
}

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

export default function DoMode({ task, onDone, onSnooze }) {
  const total = DURATION_SECS[task.timeEstimate] ?? DURATION_SECS['5to15']
  const [timeLeft, setTimeLeft] = useState(total)
  const [running, setRunning] = useState(true)
  const [celebrating, setCelebrating] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!running) {
      clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running])

  function handleDone() {
    setRunning(false)
    setCelebrating(true)
    setTimeout(onDone, 2000)
  }

  if (celebrating) {
    return (
      <div className="do-overlay">
        <Confetti />
        <div className="do-celebrate">
          <span className="do-celebrate-icon">🎉</span>
          <p className="do-celebrate-msg">Nice work!</p>
          <p className="do-celebrate-task">{task.text}</p>
        </div>
      </div>
    )
  }

  const progress = timeLeft / total
  const dashoffset = CIRC * (1 - progress)
  const expired = timeLeft === 0

  return (
    <div className="do-overlay">
      <button className="do-back" onClick={onSnooze}>← Back</button>

      <div className="do-card">
        <p className="do-label">Doing now</p>
        <p className="do-task-text">{task.text}</p>

        <div className="do-timer-wrap">
          <svg viewBox="0 0 200 200" width="200" height="200">
            <circle
              cx="100" cy="100" r={RADIUS}
              fill="none" stroke="var(--border)" strokeWidth="10"
            />
            <circle
              cx="100" cy="100" r={RADIUS}
              fill="none"
              stroke={ringColor(progress)}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashoffset}
              transform="rotate(-90 100 100)"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
            />
          </svg>
          <div className="do-time-overlay">
            <span className="do-time">{fmt(timeLeft)}</span>
            {expired && <span className="do-expired">Time's up!</span>}
          </div>
        </div>

        {!expired && (
          <button className="do-btn-pause" onClick={() => setRunning(r => !r)}>
            {running ? '⏸ Pause' : '▶ Resume'}
          </button>
        )}

        <div className="do-actions">
          <button className="do-btn-snooze" onClick={onSnooze}>Later</button>
          <button className="do-btn-done" onClick={handleDone}>Done ✓</button>
        </div>
      </div>
    </div>
  )
}
