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

export default function TaskForm({ onSave, onCancel }) {
  const [step, setStep] = useState('text')
  const [text, setText] = useState('')
  const [urgency, setUrgency] = useState(null)
  const [anxiety, setAnxiety] = useState(null)
  const [timeEstimate, setTimeEstimate] = useState(null)
  const [suggested, setSuggested] = useState(null)
  const [isSplitting, setIsSplitting] = useState(false)
  const [splitTasks, setSplitTasks] = useState([])
  const textRef = useRef(null)

  useEffect(() => {
    if (step === 'text' && textRef.current) {
      textRef.current.focus()
    }
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

  async function handleSplitYes() {
    setStep('split-loading')
    try {
      const res = await fetch('/api/split-task', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text.trim() })
      })
      const data = await res.json()
      if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 1) {
        setSplitTasks(data.tasks)
        setIsSplitting(true)
        setStep('split-review')
      } else {
        setStep('urgency')
      }
    } catch {
      setStep('urgency')
    }
  }

  function handleUrgency(val) {
    setUrgency(val)
    setStep('anxiety')
  }

  function handleAnxiety(val) {
    setAnxiety(val)
    if (isSplitting) {
      onSave(splitTasks.map(t => ({
        text: t,
        urgency,
        anxiety: val,
        timeEstimate: suggestTimeEstimate(t),
      })))
    } else {
      setStep('time')
    }
  }

  function handleTime(val) {
    onSave({ text: text.trim(), urgency, anxiety, timeEstimate: val ?? timeEstimate })
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

  function keepAsOne() {
    setIsSplitting(false)
    setSplitTasks([])
    setStep('urgency')
  }

  const dotSteps = isSplitting ? ['urgency', 'anxiety'] : ['urgency', 'anxiety', 'time']
  const showDots = dotSteps.includes(step)

  return (
    <div className="form-overlay">
      <div className="form-card">

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
                <button type="button" className="btn-ghost" onClick={handleVoice}>
                  🎤 Speak
                </button>
                <button type="button" className="btn-ghost" onClick={onCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={!text.trim()}>
                  Next
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'split-prompt' && (
          <div className="split-prompt">
            <div className="split-prompt-icon">✂️</div>
            <p className="form-label">Looks like there might be a few tasks here — want me to split them up?</p>
            <div className="split-actions">
              <button className="btn-primary" onClick={handleSplitYes}>
                Yes, split it
              </button>
              <button className="btn-ghost" onClick={keepAsOne}>
                Keep as one
              </button>
            </div>
          </div>
        )}

        {step === 'split-loading' && (
          <div className="split-loading">
            <div className="split-spinner">✂️</div>
            <p className="split-loading-text">Breaking it down…</p>
          </div>
        )}

        {step === 'split-review' && (
          <>
            <p className="form-label">Found {splitTasks.length} tasks — look good?</p>
            <ul className="split-task-list">
              {splitTasks.map((t, i) => (
                <li key={i} className="split-task-item">{t}</li>
              ))}
            </ul>
            <div className="form-actions">
              <button className="btn-ghost" onClick={keepAsOne}>
                Keep as one
              </button>
              <button className="btn-primary" onClick={() => setStep('urgency')}>
                Save {splitTasks.length} tasks →
              </button>
            </div>
          </>
        )}

        {step === 'urgency' && (
          <>
            <p className="form-label">How urgent {isSplitting ? 'are they' : 'is this'}?</p>
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

        {step === 'anxiety' && (
          <>
            <p className="form-label">How {isSplitting ? 'do they feel' : 'does this feel'}?</p>
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

        {step === 'time' && (
          <>
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

        {showDots && (
          <div className="step-dots">
            {dotSteps.map(s => (
              <span key={s} className={`dot${s === step ? ' active' : ''}`} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
