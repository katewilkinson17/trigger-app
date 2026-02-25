import { useState } from 'react'
import { getSurfacedTasks, TIME_SLOTS, getTimeEstimateShort } from '../utils/taskUtils'

const URGENCY_DOT = ['', '🟢', '🟡', '🔴']
const URGENCY_LABEL = ['', 'Low urgency', 'Medium urgency', 'High urgency']

export default function Widget({ tasks, onComplete }) {
  const [selectedSlot, setSelectedSlot] = useState(TIME_SLOTS[1]) // default: 15 min

  const surfaced = getSurfacedTasks(tasks, selectedSlot.minutes)
  const activeTasks = tasks.filter(t => !t.done)

  return (
    <section className="widget">
      <div className="widget-header">
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
        {activeTasks.length === 0 ? (
          <div className="widget-empty">
            <p>No tasks yet.</p>
            <p className="muted">Tap the button below to add one.</p>
          </div>
        ) : surfaced.length === 0 ? (
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
              {surfaced.map(task => (
                <li key={task.id} className="task-card">
                  <div className="task-card-main">
                    <span className="task-urgency-dot" title={URGENCY_LABEL[task.urgency]}>
                      {URGENCY_DOT[task.urgency]}
                    </span>
                    <span className="task-text">{task.text}</span>
                  </div>
                  <div className="task-card-meta">
                    <span className="task-time-badge">{getTimeEstimateShort(task.timeEstimate)}</span>
                    <button
                      className="btn-done"
                      onClick={() => onComplete(task.id)}
                      aria-label="Mark done"
                    >
                      ✓ Done
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
