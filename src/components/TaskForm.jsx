import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIME_ESTIMATES, TIME_ORDER, aiTimeEstimate, deriveUrgency,
         mightRecur, detectErrandLocation } from '../utils/taskUtils'

// ── Constants ─────────────────────────────────────────────────────────────────

const DREAD_LABELS = [
  { max: 2,  label: 'No dread' },
  { max: 4,  label: 'A little' },
  { max: 6,  label: 'Somewhat' },
  { max: 8,  label: 'A lot' },
  { max: 10, label: 'Dreading it' },
]

const PRESET_LOCATIONS = [
  { name: 'Grocery store', icon: '🛒' },
  { name: 'Pharmacy',      icon: '💊' },
  { name: 'Online',        icon: '🌐' },
  { name: 'Home',          icon: '🏠' },
  { name: 'Work',          icon: '💼' },
]

const RECURRENCE_OPTIONS = [
  { label: 'Weekly',        rule: type => ({ type: 'weekly',   dayOfWeek:  new Date().getDay() || 1 }) },
  { label: 'Every 2 weeks', rule: ()   => ({ type: 'biweekly' }) },
  { label: 'Monthly',       rule: ()   => ({ type: 'monthly',  dayOfMonth: new Date().getDate() }) },
  { label: 'No',            rule: ()   => null },
]

// ── Pure helpers ──────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaskForm({ userId, onSave, onCancel }) {
  // Core text & scanning
  const [step, setStep]           = useState('text')
  const [text, setText]           = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isScanning, setIsScanning]   = useState(false)

  // Photo
  const [photoUrl, setPhotoUrl]   = useState(null)

  // Per-task rate-screen state
  const [familiar, setFamiliar]             = useState(null)
  const [dread, setDread]                   = useState(5)
  const [localEstimate, setLocalEstimate]   = useState(null)
  const [deadline, setDeadline]             = useState(null)
  const [deadlineExpanded, setDeadlineExpanded] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [deadlineDateVal, setDeadlineDateVal] = useState('')

  // Split flow
  const [splitQueue, setSplitQueue] = useState([])
  const [splitIdx, setSplitIdx]     = useState(0)
  const [splitMeta, setSplitMeta]   = useState([])

  // Errand intelligence (Feature 4)
  const [suggestedLocation, setSuggestedLocation] = useState(null)
  const [errandAccepted, setErrandAccepted]       = useState(false)

  // Location step (Feature 2)
  const [locationTag, setLocationTag]         = useState(null)
  const [savedLocations, setSavedLocations]   = useState([])
  const [showCustomLoc, setShowCustomLoc]     = useState(false)
  const [customLocInput, setCustomLocInput]   = useState('')

  // Single-task meta snapshot (for location/recurrence steps)
  const [currentTaskMeta, setCurrentTaskMeta] = useState(null)

  const textRef          = useRef(null)
  const fileRef          = useRef(null)
  const estimateAdjusted = useRef(false)

  const isSplit     = splitQueue.length > 1
  const currentText = isSplit ? splitQueue[splitIdx] : text.trim()

  useEffect(() => {
    if (step === 'text' && textRef.current) textRef.current.focus()
  }, [step])

  // Load saved custom locations when entering location step
  useEffect(() => {
    if (step !== 'location' || !userId) return
    supabase
      .from('locations')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => { if (data) setSavedLocations(data) })
  }, [step, userId])

  // ── Photo upload ────────────────────────────────────────────────────────────

  async function uploadPhoto(file) {
    if (!userId || !file) return null
    try {
      const ext  = file.type.includes('png') ? 'png' : 'jpg'
      const path = `${userId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from('task-photos')
        .upload(path, file, { contentType: file.type })
      if (error) return null
      const { data } = supabase.storage.from('task-photos').getPublicUrl(path)
      return data.publicUrl
    } catch {
      return null
    }
  }

  // ── Rate-screen entry helper ────────────────────────────────────────────────

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

  // ── Text step ──────────────────────────────────────────────────────────────

  function handleTextSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    if (mightBeMultiple(text.trim())) {
      setStep('split-prompt')
    } else {
      enterRate(text.trim())
    }
  }

  // ── Split flow ─────────────────────────────────────────────────────────────

  function handleSplitYes() {
    const parts = splitLocally(text.trim())
    if (parts.length > 1) {
      setSplitQueue(parts)
      // Feature 4: check if all tasks suggest the same errand location
      const suggestion = detectErrandLocation(parts)
      if (suggestion) setSuggestedLocation(suggestion)
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
    setSuggestedLocation(null)
    setErrandAccepted(false)
    enterRate(text.trim())
  }

  function handleErrandYes() {
    setLocationTag(suggestedLocation)
    setErrandAccepted(true)
    setSuggestedLocation(null)
  }

  // ── Rate screen ────────────────────────────────────────────────────────────

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

  // ── Rate save → location step ──────────────────────────────────────────────

  function handleSave() {
    const urgency       = deriveUrgency(deadline)
    const finalEstimate = localEstimate ?? aiTimeEstimate(currentText, familiar ?? true)
    const meta = { urgency, dread, timeEstimate: finalEstimate, familiar: familiar ?? true, deadline }

    if (isSplit) {
      const newMeta = [...splitMeta, meta]
      const nextIdx = splitIdx + 1
      if (nextIdx < splitQueue.length) {
        // More tasks to rate
        setSplitMeta(newMeta)
        setSplitIdx(nextIdx)
        setFamiliar(null)
        setDread(5)
        setLocalEstimate(aiTimeEstimate(splitQueue[nextIdx], true))
        setDeadline(null)
        setDeadlineExpanded(false)
        setShowDatePicker(false)
        setDeadlineDateVal('')
        estimateAdjusted.current = false
        // stay on 'rate'
      } else {
        // All tasks rated → go to location
        setSplitMeta(newMeta)
        setStep('location')
      }
    } else {
      // Single task → store meta and go to location
      setCurrentTaskMeta(meta)
      setStep('location')
    }
  }

  // ── Location step ──────────────────────────────────────────────────────────

  async function handleAddCustomLocation() {
    const name = customLocInput.trim()
    if (!name) return
    if (userId) {
      const { data } = await supabase
        .from('locations')
        .insert({ user_id: userId, name, category: 'other' })
        .select()
        .single()
      if (data) setSavedLocations(prev => [...prev, data])
    }
    setLocationTag(name)
    setCustomLocInput('')
    setShowCustomLoc(false)
  }

  function handleLocationSave() {
    // For single non-split tasks, check if recurrence step is needed
    if (!isSplit && currentTaskMeta && mightRecur(text.trim())) {
      setStep('recurrence')
      return
    }
    callOnSave(null)
  }

  // ── Recurrence step ────────────────────────────────────────────────────────

  function handleRecurrencePick(rule) {
    callOnSave(rule)
  }

  // ── Final save ─────────────────────────────────────────────────────────────

  // rule: recurrence rule (only for single tasks) or null
  function callOnSave(recurrenceRule) {
    if (isSplit) {
      onSave(splitQueue.map((t, i) => ({
        text:        t,
        ...splitMeta[i],
        photoUrl:    photoUrl    ?? null,
        locationTag: locationTag ?? null,
      })))
    } else {
      onSave({
        text:           text.trim(),
        ...currentTaskMeta,
        photoUrl:       photoUrl        ?? null,
        locationTag:    locationTag     ?? null,
        recurrenceRule: recurrenceRule  ?? null,
      })
    }
  }

  // ── Voice input ────────────────────────────────────────────────────────────

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

  // ── Photo capture ──────────────────────────────────────────────────────────

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setIsScanning(true)
    try {
      // Upload original to storage + compress for Claude in parallel
      const [uploadedUrl, base64] = await Promise.all([
        uploadPhoto(file),
        compressImage(file),
      ])
      if (uploadedUrl) setPhotoUrl(uploadedUrl)

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

  // ── Derived display values ─────────────────────────────────────────────────

  const timeLabel  = TIME_ESTIMATES.find(t => t.value === localEstimate)?.label ?? ''
  const dreadColor = getDreadColor(dread)
  const trackStyle = {
    background: `linear-gradient(to right, ${dreadColor} ${dread * 10}%, #E8E4DF ${dread * 10}%)`
  }
  const deadlineLabel = deadline === 'today'     ? 'Today'
    : deadline === 'tomorrow'   ? 'Tomorrow'
    : deadline === 'inAFewDays' ? 'In a few days'
    : deadline?.date
      ? new Date(deadline.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const isNextTask = isSplit && splitIdx + 1 < splitQueue.length

  // ── Render ─────────────────────────────────────────────────────────────────

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
                  className={`camera-btn${photoUrl ? ' camera-has-photo' : ''}`}
                  onClick={() => fileRef.current?.click()}
                  aria-label="Scan from photo"
                  disabled={isScanning}
                >
                  {isScanning ? '⏳' : photoUrl ? '📎' : '📷'}
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
              {photoUrl && !isScanning && (
                <p className="scanning-hint" style={{ color: 'var(--green)' }}>
                  Photo attached ✓
                </p>
              )}
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

            {/* Feature 4: errand intelligence banner */}
            {suggestedLocation && !errandAccepted && (
              <div className="errand-suggest-banner">
                <p className="errand-suggest-text">
                  🛒 These all sound like <strong>{suggestedLocation}</strong> items — want to do them as one errand?
                </p>
                <div className="errand-suggest-actions">
                  <button className="btn-errand-yes" onClick={handleErrandYes}>
                    Yes, group them
                  </button>
                  <button className="btn-errand-no" onClick={() => setSuggestedLocation(null)}>
                    No
                  </button>
                </div>
              </div>
            )}
            {errandAccepted && (
              <p className="errand-accepted-note">
                📍 Grouped under <strong>{locationTag}</strong>
              </p>
            )}

            <div className="form-actions">
              <button className="btn-ghost" onClick={keepAsOne}>Keep as one</button>
              <button className="btn-primary" onClick={startSplitFlow}>Rate each →</button>
            </div>
          </>
        )}

        {/* ── Rate screen (one per task) ── */}
        {step === 'rate' && (
          <>
            {isSplit && (
              <p className="form-hint rate-task-hint">
                <span className="split-progress-badge">{splitIdx + 1}/{splitQueue.length}</span>
                <strong>{currentText}</strong>
              </p>
            )}

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

            <button className="btn-rate-save" onClick={handleSave}>
              {isNextTask ? 'Save & next →' : 'Next →'}
            </button>
          </>
        )}

        {/* ── Location step (Feature 2) ── */}
        {step === 'location' && (
          <>
            <p className="form-label">Where would you do this?</p>
            {errandAccepted && (
              <p className="errand-accepted-note" style={{ marginBottom: 12 }}>
                📍 Auto-grouped under <strong>{locationTag}</strong> — change below if needed
              </p>
            )}

            <div className="location-grid">
              {PRESET_LOCATIONS.map(loc => (
                <button
                  key={loc.name}
                  className={`location-btn${locationTag === loc.name ? ' active' : ''}`}
                  onClick={() => setLocationTag(locationTag === loc.name ? null : loc.name)}
                >
                  <span className="location-icon">{loc.icon}</span>
                  {loc.name}
                </button>
              ))}

              {savedLocations.map(loc => (
                <button
                  key={loc.id}
                  className={`location-btn${locationTag === loc.name ? ' active' : ''}`}
                  onClick={() => setLocationTag(locationTag === loc.name ? null : loc.name)}
                >
                  <span className="location-icon">📍</span>
                  {loc.name}
                </button>
              ))}

              {!showCustomLoc ? (
                <button
                  className="location-btn location-btn-add"
                  onClick={() => setShowCustomLoc(true)}
                >
                  + Add place
                </button>
              ) : (
                <div className="location-custom-wrap">
                  <input
                    autoFocus
                    className="location-custom-input"
                    placeholder="Place name…"
                    value={customLocInput}
                    onChange={e => setCustomLocInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddCustomLocation() }}
                  />
                  <button className="btn-primary" style={{ flex: 'none', height: 44, padding: '0 16px', fontSize: 15 }} onClick={handleAddCustomLocation}>
                    Add
                  </button>
                </div>
              )}
            </div>

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button className="btn-ghost" onClick={handleLocationSave}>Skip</button>
              <button className="btn-primary" onClick={handleLocationSave}>
                {!isSplit && mightRecur(text.trim()) ? 'Next →' : 'Save task ✓'}
              </button>
            </div>
          </>
        )}

        {/* ── Recurrence step (Feature 3 — single tasks that sound recurring) ── */}
        {step === 'recurrence' && (
          <>
            <p className="form-label">Does this repeat?</p>
            <div className="recurrence-options">
              {RECURRENCE_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  className="recurrence-btn"
                  onClick={() => handleRecurrencePick(opt.rule())}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
