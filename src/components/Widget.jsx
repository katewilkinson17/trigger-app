import { useState } from 'react'
import { getSurfacedTasks, TIME_SLOTS, getTimeEstimateShort } from '../utils/taskUtils'

const URGENCY_DOT   = ['', '🟢', '🟡', '🔴']
const URGENCY_LABEL = ['', 'Low urgency', 'Medium urgency', 'High urgency']

// Group surfaced tasks by locationTag when 2+ share the same one
function groupTasks(tasks) {
  const locMap    = {}
  const ungrouped = []

  tasks.forEach(task => {
    if (task.locationTag) {
      if (!locMap[task.locationTag]) locMap[task.locationTag] = []
      locMap[task.locationTag].push(task)
    } else {
      ungrouped.push(task)
    }
  })

  const items = []
  Object.entries(locMap).forEach(([location, locTasks]) => {
    if (locTasks.length >= 2) {
      items.push({ type: 'errand', location, tasks: locTasks })
    } else {
      ungrouped.push(...locTasks)  // lone location-tagged task → show normally
    }
  })
  ungrouped.forEach(task => items.push({ type: 'task', task }))
  return items
}

export default function Widget({ tasks, onComplete, onDump, onDo }) {
  const [selectedSlot, setSelectedSlot] = useState(TIME_SLOTS[1])

  const surfaced    = getSurfacedTasks(tasks, selectedSlot.minutes)
  const activeTasks = tasks.filter(t => !t.done)
  const groupedItems = groupTasks(surfaced)

  if (activeTasks.length === 0) {
    return (
      <section className="widget widget-is-empty">
        <div className="empty-hero" onClick={onDump} role="button" tabIndex={0}>
          <div className="empty-hero-icon">🧠</div>
          <p className="empty-hero-title">Brain clear?</p>
          <p className="empty-hero-sub">Drop something here.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="widget">
      <div className="widget-header">
        <p className="task-count-friendly">
          {activeTasks.length} thing{activeTasks.length !== 1 ? 's' : ''} on your mind
        </p>
        <p className="widget-title">How much time do you have?</p>
        <div className="slot-row">
          {TIME_SLOTS.map(slot => (
            <button
              key={slot.label}
              className={`slot-btn${slot.label === selectedSlot.label ? ' active' : ''}`}
              onClick={() => setSelectedSlot(slot)}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </div>

      <div className="widget-body">
        {groupedItems.length === 0 ? (
          <div className="widget-empty">
            <p>No tasks fit in {selectedSlot.label}.</p>
            <p className="muted">Try a longer time slot, or check your full list.</p>
          </div>
        ) : (
          <>
            <p className="widget-context">
              You have <strong>{selectedSlot.label}</strong> — here's what fits:
            </p>
            <ul className="task-cards">
              {groupedItems.map((item, i) =>
                item.type === 'errand' ? (
                  // ── Errand group card (Feature 2) ──
                  <li key={`errand-${item.location}`} className="task-card errand-card">
                    <div className="errand-header">
                      <span className="errand-pin">📍</span>
                      <span className="errand-location-name">{item.location}</span>
                      <span className="errand-count-badge">
                        {item.tasks.length} thing{item.tasks.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="errand-task-pills">
                      {item.tasks.map(t => (
                        <span key={t.id} className="errand-task-pill">{t.text}</span>
                      ))}
                    </div>
                    <div className="task-card-meta">
                      <span className="task-time-badge errand-time-badge">errand</span>
                      <div className="task-card-btns">
                        <button
                          className="btn-do"
                          onClick={() => onDo(item.tasks[0])}
                          aria-label="Start errand"
                        >
                          ▶ Start
                        </button>
                        <button
                          className="btn-done"
                          onClick={() => item.tasks.forEach(t => onComplete(t.id))}
                          aria-label="Mark all done"
                          title="Mark all done"
                        >
                          ✓ All
                        </button>
                      </div>
                    </div>
                  </li>
                ) : (
                  // ── Regular task card ──
                  <li key={item.task.id} className="task-card">
                    <div className="task-card-main">
                      <span className="task-urgency-dot" title={URGENCY_LABEL[item.task.urgency]}>
                        {URGENCY_DOT[item.task.urgency]}
                      </span>
                      <span className="task-text">{item.task.text}</span>
                    </div>
                    <div className="task-card-meta">
                      <div className="task-card-left">
                        <span className="task-time-badge">{getTimeEstimateShort(item.task.timeEstimate)}</span>
                        {item.task.locationTag && (
                          <span className="task-location-pill">📍 {item.task.locationTag}</span>
                        )}
                        {item.task.recurrenceRule && (
                          <span className="task-recurring-badge">🔄</span>
                        )}
                      </div>
                      <div className="task-card-btns">
                        <button
                          className="btn-do"
                          onClick={() => onDo(item.task)}
                          aria-label="Start doing"
                        >
                          ▶ Do it
                        </button>
                        <button
                          className="btn-done"
                          onClick={() => onComplete(item.task.id)}
                          aria-label="Mark done"
                        >
                          ✓
                        </button>
                      </div>
                    </div>
                  </li>
                )
              )}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
