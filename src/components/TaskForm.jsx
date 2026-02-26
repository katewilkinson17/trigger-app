import { useState, useRef, useEffect } from 'react'
import { TIME_ESTIMATES, suggestTimeEstimate } from '../utils/taskUtils'

const URGENCY_OPTIONS = [
  { value: 1, emoji: '🟢', label: 'Whenever' },
  { value: 2, emoji: '🟡', label: 'Soon' },
  { value: 3, emoji: '🔴', label: 'Today' },
]

const ANXIETY_OPTIONS = [
  { value: 1, emoji: '😌', label: 'Easy' },
  { value: 2, emoji: '😐', label: 'A little' },
  { value: 3, emoji: '😬', label: 'Dreading it' },
]

function mightBeMultiple(text) {
  const lower = text.toLowerCase()
  return (
    lower.includes(' and ') ||
    lower.includes(' then ') ||
    lower.includes(' also ') ||
    text.includes(',')
  )
}

// Local split — no API required
function splitLocally(text) {
  if (text.includes(',')) {
    const parts = text.split(',').map(t => t.trim()).filter(Boolean)
    if (parts.length > 1) return parts
  }
  const parts = text.split(/ and | then | also /i).map(t => t.trim()).filter(Boolean)
  if (parts.length > 1) return parts
  return [text]
}

export default function TaskForm({ onSave, onCancel }) {
  const [step, setStep] = useState('text')
  const [text, setText] = useState('')

  // Per-step values (reset for each task in split flow)
  const [urgency, setUrgency] = useState(null)
  const [anxiety, setAnxiety] = useState(null)
  const [timeEstimate, setTimeEstimate] = useState(null)
  const [suggested, setSuggested] = useState(null)

  // Split flow state
  const [splitQueue, setSplitQueue] = useState([])   // array of task text strings
  const [splitIdx, setSplitIdx] = useState(0)         // which task we're rating
  const [splitMeta, setSplitMeta] = useState([])      // collected {urgency,anxiety,timeEstimate}

  const textRef = useRef(null)

  const isSplit = splitQueue.length > 1
  const currentText = isSplit ? splitQueue[splitIdx] : text.trim()

  useEffect(() => {
    if (step === 'text' && textRef.current) textRef.current.focus()
  }, [step])

  function handleTextSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    const suggestion = suggestTimeEstimate(text.trim())
    setSuggested(suggestion)
    setTimeEstimate(suggestion)
    if (mightBeMultiple(text.trim())) {
      setStep('split-prompt')
    } else {
      setStep('urgency')
    }
  }

  function handleSplitYes() {
    const parts = splitLocally(text.trim())
    if (parts.length > 1) {
      setSplitQueue(parts)
      setStep('split-review')
    } else {
      setStep('urgency')
    }
  }

  // Begin rating each split task one at a time
  function startSplitFlow() {
    const idx = 0
    setSplitIdx(idx)
    setSplitMeta([])
    const suggestion = suggestTimeEstimate(splitQueue[idx])
    setSuggested(suggestion)
    setTimeEstimate(suggestion)
    setUrgency(null)
    setAnxiety(null)
    setStep('urgency')
  }

  function keepAsOne() {
    setSplitQueue([])
    setSplitIdx(0)
    setSplitMeta([])
    const suggestion = suggestTimeEstimate(text.trim())
    setSuggested(suggestion)
    setTimeEstimate(suggestion)
    setUrgency(null)
    setAnxiety(null)
    setStep('urgency')
  }

  function handleUrgency(val) {
    setUrgency(val)
    setStep('anxiety')
  }

  function handleAnxiety(val) {
    setAnxiety(val)
    setStep('time')
  }

  function handleTime(val) {
    const chosenTime = val ?? timeEstimate
    if (isSplit) {
      const newMeta = [...splitMeta, { urgency, anxiety, timeEstimate: chosenTime }]
      if (splitIdx + 1 < splitQueue.length) {
        // More tasks — advance to next
        const nextIdx = splitIdx + 1
        setSplitMeta(newMeta)
        setSplitIdx(nextIdx)
        const suggestion = suggestTimeEstimate(splitQueue[nextIdx])
        setSuggested(suggestion)
        setTimeEstimate(suggestion)
        setUrgency(null)
        setAnxiety(null)
        setStep('urgency')
      } else {
        // All tasks rated — save them all
        onSave(splitQueue.map((t, i) => ({ text: t, ...newMeta[i] })))
      }
    } else {
      onSave({ text: text.trim(), urgency, anxiety, timeEstimate: chosenTime })
    }
  }

  function handleVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.')
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.onresult = (e) => { setText(e.results[0][0].transcript) }
    recognition.start()
  }

  const inRatingSteps = ['urgency', 'anxiety', 'time'].includes(step)

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
                placeholder="Type your task..."
                rows={3}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleTextSubmit(e)
                  }
                }}
              />
              <div className="form-actions">
                <button type="button" className="btn-ghost" onClick={handleVoice}>🎤 Speak</button>
                <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={!text.trim()}>Next</button>
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
              {splitQueue.map((t, i) => (
                <li key={i} className="split-task-item">{t}</li>
              ))}
            </ul>
            <div className="form-actions">
              <button className="btn-ghost" onClick={keepAsOne}>Keep as one</button>
              <button className="btn-primary" onClick={startSplitFlow}>Rate each →</button>
            </div>
          </>
        )}

        {/* ── Urgency ── */}
        {step === 'urgency' && (
          <>
            {isSplit && (
              <p className="form-hint">
                <span className="split-progress-badge">{splitIdx + 1}/{splitQueue.length}</span>
                <strong>{currentText}</strong>
              </p>
            )}
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

        {/* ── Anxiety ── */}
        {step === 'anxiety' && (
          <>
            {isSplit && (
              <p className="form-hint">
                <span className="split-progress-badge">{splitIdx + 1}/{splitQueue.length}</span>
                <strong>{currentText}</strong>
              </p>
            )}
            <p className="form-label">How does this feel?</p>
            <div className="rating-row">
              {ANXIETY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`rating-btn rating-anxiety-${opt.value}`}
                  onClick={() => handleAnxiety(opt.value)}
                >
                  <span className="rating-emoji">{opt.emoji}</span>
                  <span className="rating-sub">{opt.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Time estimate ── */}
        {step === 'time' && (
          <>
            {isSplit && (
              <p className="form-hint">
                <span className="split-progress-badge">{splitIdx + 1}/{splitQueue.length}</span>
                <strong>{currentText}</strong>
              </p>
            )}
            <p className="form-label">How long will this take?</p>
            {suggested && (
              <p className="form-hint">We think: <strong>{TIME_ESTIMATES.find(t => t.value === suggested)?.label}</strong></p>
            )}
            <div className="time-grid">
              {TIME_ESTIMATES.map(t => (
                <button
                  key={t.value}
                  className={`time-btn${t.value === timeEstimate ? ' selected' : ''}`}
                  onClick={() => handleTime(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step dots */}
        {inRatingSteps && (
          <div className="step-dots">
            {['urgency', 'anxiety', 'time'].map(s => (
              <span key={s} className={`dot${s === step ? ' active' : ''}`} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
