import { useState, useRef, useEffect } from 'react'
import { TIME_ESTIMATES, TIME_ORDER, aiTimeEstimate, deriveUrgency } from '../utils/taskUtils'

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

async function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const maxDim = 1024
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim }
        else { w = Math.round(w * maxDim / h); h = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
    }
    img.src = url
  })
}

export default function TaskForm({ onSave, onCancel }) {
  const [step, setStep]           = useState('text')
  const [text, setText]           = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isScanning, setIsScanning]   = useState(false)

  // Per-task rate-screen state
  const [familiar, setFamiliar]               = useState(null)
  const [dread, setDread]                     = useState(5)
  const [localEstimate, setLocalEstimate]     = useState(null)
  const [deadline, setDeadline]               = useState(null)
  const [deadlineExpanded, setDeadlineExpanded] = useState(false)
  const [showDatePicker, setShowDatePicker]   = useState(false)
  const [deadlineDateVal, setDeadlineDateVal] = useState('')

  // Split flow
  const [splitQueue, setSplitQueue] = useState([])
  const [splitIdx, setSplitIdx]     = useState(0)
  const [splitMeta, setSplitMeta]   = useState([])

  const textRef            = useRef(null)
  const fileRef            = useRef(null)
  const estimateAdjusted   = useRef(false)

  const isSplit     = splitQueue.length > 1
  const currentText = isSplit ? splitQueue[splitIdx] : text.trim()

  useEffect(() => {
    if (step === 'text' && textRef.current) textRef.current.focus()
  }, [step])

  // ── Shared rate-screen entry helper ────────────────────────────────
  function enterRate(taskText) {
    setFamiliar(null)
    setDread(5)
    setLocalEstimate(aiTimeEstimate(taskText, true))
    setDeadline(null)
    setDeadlineExpanded(false)
    setShowDatePicker(false)
    setDeadlineDateVal('')
    estimateAdjusted.current = false
    setStep('rate')
  }

  // ── Text step ──────────────────────────────────────────────────────
  function handleTextSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    if (mightBeMultiple(text.trim())) {
      setStep('split-prompt')
    } else {
      enterRate(text.trim())
    }
  }

  // ── Split flow ─────────────────────────────────────────────────────
  function handleSplitYes() {
    const parts = splitLocally(text.trim())
    if (parts.length > 1) {
      setSplitQueue(parts)
      setStep('split-review')
    } else {
      enterRate(text.trim())
    }
  }

  function startSplitFlow() {
    setSplitIdx(0)
    setSplitMeta([])
    enterRate(splitQueue[0])
  }

  function keepAsOne() {
    setSplitQueue([])
    setSplitIdx(0)
    setSplitMeta([])
    enterRate(text.trim())
  }

  // ── Rate screen interactions ───────────────────────────────────────
  function handleFamiliarChange(val) {
    setFamiliar(val)
    if (!estimateAdjusted.current) {
      setLocalEstimate(aiTimeEstimate(currentText, val))
    }
  }

  function adjustEstimate(dir) {
    estimateAdjusted.current = true
    const idx = TIME_ORDER.indexOf(localEstimate)
    if (dir === 'quicker') setLocalEstimate(TIME_ORDER[Math.max(0, idx - 1)])
    else setLocalEstimate(TIME_ORDER[Math.min(3, idx + 1)])
  }

  function handleDeadlineChoice(val) {
    setDeadline(val)
    setShowDatePicker(false)
    if (val !== null) setDeadlineExpanded(false)
  }

  // ── Save ───────────────────────────────────────────────────────────
  function handleSave() {
    const urgency      = deriveUrgency(deadline)
    const finalEstimate = localEstimate ?? aiTimeEstimate(currentText, familiar ?? true)
    const meta = { urgency, dread, timeEstimate: finalEstimate, familiar: familiar ?? true, deadline }

    if (isSplit) {
      const newMeta = [...splitMeta, meta]
      const nextIdx = splitIdx + 1
      if (nextIdx < splitQueue.length) {
        setSplitMeta(newMeta)
        setSplitIdx(nextIdx)
        // Reset for next task and set new estimate inline (no step change)
        setFamiliar(null)
        setDread(5)
        setLocalEstimate(aiTimeEstimate(splitQueue[nextIdx], true))
        setDeadline(null)
        setDeadlineExpanded(false)
        setShowDatePicker(false)
        setDeadlineDateVal('')
        estimateAdjusted.current = false
      } else {
        onSave(splitQueue.map((t, i) => ({ text: t, ...newMeta[i] })))
      }
    } else {
      onSave({ text: text.trim(), ...meta })
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
    recognition.onresult = e => { setText(e.results[0][0].transcript); setIsRecording(false) }
    recognition.start()
  }

  // ── Photo capture ──────────────────────────────────────────────────
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setIsScanning(true)
    try {
      const base64 = await compressImage(file)
      const res = await fetch('/api/scan-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      if (!res.ok) throw new Error('scan failed')
      const data = await res.json()
      if (data.task) setText(data.task)
      if (data.deadline) {
        setDeadlineDateVal(data.deadline)
        setDeadline({ date: data.deadline })
        setDeadlineExpanded(true)
      }
    } catch {
      // silently ignore — user keeps existing text
    } finally {
      setIsScanning(false)
    }
  }

  // ── Derived display values ─────────────────────────────────────────
  const timeLabel  = TIME_ESTIMATES.find(t => t.value === localEstimate)?.label ?? ''
  const dreadColor = getDreadColor(dread)
  const trackStyle = {
    background: `linear-gradient(to right, ${dreadColor} ${dread * 10}%, #E8E4DF ${dread * 10}%)`
  }
  const deadlineLabel = deadline === 'today'      ? 'Today'
    : deadline === 'tomorrow'    ? 'Tomorrow'
    : deadline === 'inAFewDays'  ? 'In a few days'
    : deadline?.date
      ? new Date(deadline.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const isNextTask = isSplit && splitIdx + 1 < splitQueue.length

  return (
    <div className="form-overlay">
      <div className="form-card">

        {/* ── Screen 1: Text entry ── */}
        {step === 'text' && (
          <>
            <p className="form-label">What's on your mind?</p>
            <form onSubmit={handleTextSubmit}>
              <div className="text-input-wrap">
                <textarea
                  ref={textRef}
                  className="task-input"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Type it out, or tap the mic…"
                  rows={3}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(e) }
                  }}
                />
                <button
                  type="button"
                  className="camera-btn"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Scan from photo"
                  disabled={isScanning}
                >
                  {isScanning ? '⏳' : '📷'}
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {isScanning && <p className="scanning-hint">Scanning image…</p>}
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
                <button type="submit" className="btn-primary" disabled={!text.trim() || isScanning}>Next →</button>
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

        {/* ── Screen 2: Rate screen (one per task) ── */}
        {step === 'rate' && (
          <>
            {isSplit && (
              <p className="form-hint rate-task-hint">
                <span className="split-progress-badge">{splitIdx + 1}/{splitQueue.length}</span>
                <strong>{currentText}</strong>
              </p>
            )}

            {/* Dread slider */}
            <p className="rate-question">How much are you dreading this?</p>
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

            {/* Familiar inline pills */}
            <div className="familiar-inline-row">
              <span className="familiar-inline-label">Done this before?</span>
              <div className="familiar-pills">
                <button
                  className={`familiar-pill${familiar === true ? ' active' : ''}`}
                  onClick={() => handleFamiliarChange(true)}
                >Yes</button>
                <button
                  className={`familiar-pill${familiar === false ? ' active' : ''}`}
                  onClick={() => handleFamiliarChange(false)}
                >Nope</button>
              </div>
            </div>
            {familiar === false && (
              <p className="novel-task-warning">
                💡 New tasks often take longer than expected.
              </p>
            )}

            {/* Time estimate adjuster */}
            <div className="time-inline-row">
              <button
                className="time-inline-adj"
                onClick={() => adjustEstimate('quicker')}
                disabled={TIME_ORDER.indexOf(localEstimate) === 0}
                aria-label="Quicker"
              >← Quicker</button>
              <span className="time-inline-label">{timeLabel}</span>
              <button
                className="time-inline-adj"
                onClick={() => adjustEstimate('longer')}
                disabled={TIME_ORDER.indexOf(localEstimate) === 3}
                aria-label="Longer"
              >Longer →</button>
            </div>

            {/* Collapsible deadline */}
            {!deadlineExpanded ? (
              <button
                className={`deadline-expand-btn${deadlineLabel ? ' has-value' : ''}`}
                onClick={() => setDeadlineExpanded(true)}
              >
                {deadlineLabel ? `📅 ${deadlineLabel} ▾` : '+ Add deadline'}
              </button>
            ) : (
              <div className="deadline-inline-wrap">
                <div className="deadline-inline-grid">
                  {[
                    { val: 'today',      label: 'Today' },
                    { val: 'tomorrow',   label: 'Tomorrow' },
                    { val: 'inAFewDays', label: 'In a few days' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      className={`deadline-inline-btn${deadline === opt.val ? ' active' : ''}`}
                      onClick={() => handleDeadlineChoice(opt.val)}
                    >{opt.label}</button>
                  ))}
                  <button
                    className={`deadline-inline-btn${deadline?.date ? ' active' : ''}`}
                    onClick={() => setShowDatePicker(p => !p)}
                  >Pick a date</button>
                  <button
                    className={`deadline-inline-btn deadline-inline-skip${!deadline && !showDatePicker ? ' active' : ''}`}
                    onClick={() => handleDeadlineChoice(null)}
                  >No rush</button>
                </div>
                {showDatePicker && (
                  <input
                    type="date"
                    className="deadline-date-input"
                    value={deadlineDateVal}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => {
                      setDeadlineDateVal(e.target.value)
                      if (e.target.value) {
                        setDeadline({ date: e.target.value })
                        setDeadlineExpanded(false)
                        setShowDatePicker(false)
                      }
                    }}
                  />
                )}
              </div>
            )}

            <button
              className="btn-rate-save"
              onClick={handleSave}
            >
              {isNextTask ? 'Save & next →' : 'Save task ✓'}
            </button>
          </>
        )}

      </div>
    </div>
  )
}
