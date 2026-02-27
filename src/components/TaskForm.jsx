import { useState, useRef, useEffect } from 'react'
import { TIME_ESTIMATES, TIME_ORDER, aiTimeEstimate } from '../utils/taskUtils'

const URGENCY_OPTIONS = [
  { value: 1, emoji: '🟢', label: 'Whenever' },
  { value: 2, emoji: '🟡', label: 'Soon' },
  { value: 3, emoji: '🔴', label: 'Today' },
]

const DREAD_LABELS = [
  { max: 2,  label: 'No dread' },
  { max: 4,  label: 'A little' },
  { max: 6,  label: 'Somewhat' },
  { max: 8,  label: 'A lot' },
  { max: 10, label: 'Dreading it' },
]

function getDreadLabel(val) {
  return DREAD_LABELS.find(d => val <= d.max)?.label ?? 'Dreading it'
}

function getDreadColor(val) {
  if (val <= 3) return '#2EA87E'
  if (val <= 6) return '#D9A225'
  return '#E84F4F'
}

function mightBeMultiple(text) {
  const lower = text.toLowerCase()
  return (
    lower.includes(' and ') ||
    lower.includes(' then ') ||
    lower.includes(' also ') ||
    text.includes(',')
  )
}

function splitLocally(text) {
  if (text.includes(',')) {
    const parts = text.split(',').map(t => t.trim()).filter(Boolean)
    if (parts.length > 1) return parts
  }
  const parts = text.split(/ and | then | also /i).map(t => t.trim()).filter(Boolean)
  if (parts.length > 1) return parts
  return [text]
}

const RATING_STEPS = ['familiar', 'urgency', 'dread', 'time-suggest', 'deadline']

export default function TaskForm({ onSave, onCancel }) {
  const [step, setStep] = useState('text')
  const [text, setText] = useState('')
  const [isRecording, setIsRecording] = useState(false)

  // Per-task state (reset between tasks in split flow)
  const [familiar, setFamiliar]           = useState(null)
  const [urgency, setUrgency]             = useState(null)
  const [dread, setDread]                 = useState(5)
  const [timeEstimate, setTimeEstimate]   = useState(null)
  const [deadline, setDeadline]           = useState(null)
  const [deadlineDateVal, setDeadlineDateVal] = useState('')

  // Split flow
  const [splitQueue, setSplitQueue] = useState([])
  const [splitIdx, setSplitIdx]     = useState(0)
  const [splitMeta, setSplitMeta]   = useState([])

  const textRef = useRef(null)

  const isSplit    = splitQueue.length > 1
  const currentText = isSplit ? splitQueue[splitIdx] : text.trim()

  useEffect(() => {
    if (step === 'text' && textRef.current) textRef.current.focus()
  }, [step])

  // ── Text step ──────────────────────────────────────────────────────
  function handleTextSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    if (mightBeMultiple(text.trim())) {
      setStep('split-prompt')
    } else {
      setStep('familiar')
    }
  }

  // ── Split flow ─────────────────────────────────────────────────────
  function handleSplitYes() {
    const parts = splitLocally(text.trim())
    if (parts.length > 1) {
      setSplitQueue(parts)
      setStep('split-review')
    } else {
      setStep('familiar')
    }
  }

  function startSplitFlow() {
    setSplitIdx(0)
    setSplitMeta([])
    resetPerTask()
    setStep('familiar')
  }

  function keepAsOne() {
    setSplitQueue([])
    setSplitIdx(0)
    setSplitMeta([])
    resetPerTask()
    setStep('familiar')
  }

  function resetPerTask() {
    setFamiliar(null)
    setUrgency(null)
    setDread(5)
    setDeadline(null)
    setDeadlineDateVal('')
    setTimeEstimate(null)
  }

  // ── Per-task rating steps ──────────────────────────────────────────
  function handleFamiliar(val) {
    setFamiliar(val)
    setTimeEstimate(aiTimeEstimate(currentText, val))
    setStep('urgency')
  }

  function handleUrgency(val) {
    setUrgency(val)
    setStep('dread')
  }

  function handleDreadNext() {
    setStep('time-suggest')
  }

  function handleTimeSuggest(dir) {
    const idx      = TIME_ORDER.indexOf(timeEstimate)
    const finalIdx = dir === 'quicker'
      ? Math.max(0, idx - 1)
      : dir === 'longer'
        ? Math.min(3, idx + 1)
        : idx
    setTimeEstimate(TIME_ORDER[finalIdx])
    setStep('deadline')
  }

  function handleDeadline(val) {
    const meta = { urgency, dread, timeEstimate, familiar, deadline: val }
    if (isSplit) {
      const newMeta = [...splitMeta, meta]
      if (splitIdx + 1 < splitQueue.length) {
        setSplitMeta(newMeta)
        setSplitIdx(splitIdx + 1)
        resetPerTask()
        setStep('familiar')
      } else {
        onSave(splitQueue.map((t, i) => ({ text: t, ...newMeta[i] })))
      }
    } else {
      onSave({ text: text.trim(), urgency, dread, timeEstimate, familiar, deadline: val })
    }
  }

  // ── Voice input ────────────────────────────────────────────────────
  function handleVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in this browser.')
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.onstart  = () => setIsRecording(true)
    recognition.onend    = () => setIsRecording(false)
    recognition.onerror  = () => setIsRecording(false)
    recognition.onresult = e  => { setText(e.results[0][0].transcript); setIsRecording(false) }
    recognition.start()
  }

  // ── Rendering helpers ──────────────────────────────────────────────
  const activeDot   = step === 'deadline-date' ? 'deadline' : step
  const showDots    = RATING_STEPS.includes(activeDot)
  const timeLabel   = TIME_ESTIMATES.find(t => t.value === timeEstimate)?.label ?? ''
  const dreadColor  = getDreadColor(dread)
  const trackStyle  = {
    background: `linear-gradient(to right, ${dreadColor} ${dread * 10}%, #E8E4DF ${dread * 10}%)`
  }

  function SplitBadge() {
    if (!isSplit) return null
    return (
      <p className="form-hint">
        <span className="split-progress-badge">{splitIdx + 1}/{splitQueue.length}</span>
        <strong>{currentText}</strong>
      </p>
    )
  }

  return (
    <div className="form-overlay">
      <div className="form-card">

        {/* ── Text entry ── */}
        {step === 'text' && (
          <>
            <p className="form-label">What's on your mind?</p>
            <form onSubmit={handleTextSubmit}>
              <textarea
                ref={textRef}
                className="task-input"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type it out, or tap the mic below…"
                rows={3}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(e) }
                }}
              />
              <div className="voice-section">
                <button
                  type="button"
                  className={`voice-btn${isRecording ? ' voice-btn-active' : ''}`}
                  onClick={handleVoice}
                  aria-label={isRecording ? 'Listening…' : 'Tap to speak'}
                >
                  {isRecording ? '⏹' : '🎤'}
                </button>
                <p className="voice-hint">{isRecording ? 'Listening…' : 'Tap to speak'}</p>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={!text.trim()}>Next →</button>
              </div>
            </form>
          </>
        )}

        {/* ── Split prompt ── */}
        {step === 'split-prompt' && (
          <div className="split-prompt">
            <div className="split-prompt-icon">✂️</div>
            <p className="form-label">Looks like there might be a few tasks here — want me to split them up?</p>
            <div className="split-actions">
              <button className="btn-primary" onClick={handleSplitYes}>Yes, split it</button>
              <button className="btn-ghost" onClick={keepAsOne}>Keep as one</button>
            </div>
          </div>
        )}

        {/* ── Split review ── */}
        {step === 'split-review' && (
          <>
            <p className="form-label">Found {splitQueue.length} tasks — look good?</p>
            <ul className="split-task-list">
              {splitQueue.map((t, i) => <li key={i} className="split-task-item">{t}</li>)}
            </ul>
            <div className="form-actions">
              <button className="btn-ghost" onClick={keepAsOne}>Keep as one</button>
              <button className="btn-primary" onClick={startSplitFlow}>Rate each →</button>
            </div>
          </>
        )}

        {/* ── Familiar ── */}
        {step === 'familiar' && (
          <>
            <SplitBadge />
            <p className="form-label">Have you done this before?</p>
            <div className="familiar-row">
              <button className="familiar-btn familiar-yes" onClick={() => handleFamiliar(true)}>
                <span className="familiar-icon">✅</span>
                <span className="familiar-label">Done it before</span>
              </button>
              <button className="familiar-btn familiar-no" onClick={() => handleFamiliar(false)}>
                <span className="familiar-icon">✨</span>
                <span className="familiar-label">First time!</span>
              </button>
            </div>
          </>
        )}

        {/* ── Urgency ── */}
        {step === 'urgency' && (
          <>
            <SplitBadge />
            <p className="form-label">How urgent is this?</p>
            <div className="rating-row">
              {URGENCY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`rating-btn rating-urgency-${opt.value}`}
                  onClick={() => handleUrgency(opt.value)}
                >
                  <span className="rating-emoji">{opt.emoji}</span>
                  <span className="rating-sub">{opt.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Dread slider (SUDS 0–10) ── */}
        {step === 'dread' && (
          <>
            <SplitBadge />
            <p className="form-label">How much are you dreading this?</p>
            <div className="suds-wrap">
              <div className="suds-value" style={{ color: dreadColor }}>{dread}</div>
              <div className="suds-value-label">{getDreadLabel(dread)}</div>
              <input
                type="range"
                min={0} max={10} step={1}
                value={dread}
                onChange={e => setDread(Number(e.target.value))}
                className="suds-slider"
                style={trackStyle}
                aria-label="Dread level, 0 to 10"
              />
              <div className="suds-labels">
                <span>Easy, no worries</span>
                <span>Really dreading this</span>
              </div>
            </div>
            <button className="btn-primary" onClick={handleDreadNext}>Next →</button>
          </>
        )}

        {/* ── AI time suggestion ── */}
        {step === 'time-suggest' && (
          <>
            <SplitBadge />
            {familiar === false && (
              <p className="novel-task-warning">
                💡 Heads up — new tasks often take longer than expected.
              </p>
            )}
            <p className="form-label">
              I'm thinking <strong>{timeLabel}</strong> — sound right?
            </p>
            <div className="time-adjust-row">
              <button
                className="time-adjust-btn"
                onClick={() => handleTimeSuggest('quicker')}
                disabled={TIME_ORDER.indexOf(timeEstimate) === 0}
              >
                ← Quicker
              </button>
              <button
                className="time-adjust-btn time-adjust-btn-main"
                onClick={() => handleTimeSuggest('same')}
              >
                About right ✓
              </button>
              <button
                className="time-adjust-btn"
                onClick={() => handleTimeSuggest('longer')}
                disabled={TIME_ORDER.indexOf(timeEstimate) === 3}
              >
                Longer →
              </button>
            </div>
          </>
        )}

        {/* ── Deadline ── */}
        {step === 'deadline' && (
          <>
            <SplitBadge />
            <p className="form-label">Does this have a deadline?</p>
            <p className="form-hint">Optional — skip if not relevant.</p>
            <div className="deadline-grid">
              <button className="deadline-btn" onClick={() => handleDeadline('thisWeek')}>This week</button>
              <button className="deadline-btn" onClick={() => handleDeadline('thisMonth')}>This month</button>
              <button className="deadline-btn" onClick={() => setStep('deadline-date')}>Pick a date</button>
              <button className="deadline-btn deadline-btn-skip" onClick={() => handleDeadline(null)}>No deadline</button>
            </div>
          </>
        )}

        {/* ── Deadline date picker ── */}
        {step === 'deadline-date' && (
          <>
            <p className="form-label">When is it due?</p>
            <input
              type="date"
              className="deadline-date-input"
              value={deadlineDateVal}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setDeadlineDateVal(e.target.value)}
            />
            <div className="form-actions">
              <button className="btn-ghost" onClick={() => handleDeadline(null)}>Skip</button>
              <button
                className="btn-primary"
                disabled={!deadlineDateVal}
                onClick={() => handleDeadline({ date: deadlineDateVal })}
              >
                Set deadline
              </button>
            </div>
          </>
        )}

        {/* Step dots */}
        {showDots && (
          <div className="step-dots">
            {RATING_STEPS.map(s => (
              <span key={s} className={`dot${s === activeDot ? ' active' : ''}`} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
