import { getTimeEstimateShort, priorityScore } from '../utils/taskUtils'

const URGENCY_DOT = ['', '🟢', '🟡', '🔴']

function formatDeadline(deadline) {
  if (!deadline) return null
  if (deadline === 'thisWeek')  return '📅 This week'
  if (deadline === 'thisMonth') return '📅 This month'
  if (deadline?.date) {
    const d = new Date(deadline.date)
    return `📅 ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }
  return null
}

export default function TaskList({ tasks, onComplete, onDelete, onRestore }) {
  const active    = tasks.filter(t => !t.done).sort((a, b) => priorityScore(b) - priorityScore(a))
  const doneToday = tasks.filter(t => t.done)

  function handleComplete(id) {
    if (navigator.vibrate) navigator.vibrate(50)
    onComplete(id)
  }

  return (
    <section className="task-list-view">
      <h2 className="section-title">All Tasks</h2>

      {active.length === 0 && doneToday.length === 0 && (
        <div className="list-empty">
          <p>Nothing here yet.</p>
          <p className="muted">Tap the big button to dump your first task.</p>
        </div>
      )}

      {active.length > 0 && (
        <ul className="full-task-list">
          {active.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onComplete={handleComplete}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}

      {doneToday.length > 0 && (
        <>
          <h3 className="section-subtitle">Done Today ✓</h3>
          <ul className="full-task-list done-list">
            {doneToday.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                isDone
                onRestore={onRestore}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function TaskRow({ task, isDone, onComplete, onDelete, onRestore }) {
  const dreadVal      = task.dread != null ? task.dread : null
  const deadlineLabel = formatDeadline(task.deadline)

  return (
    <li className={`full-task-row${isDone ? ' done' : ''}`}>
      <div className="full-task-info">
        <span className="task-urgency-dot" title={`Urgency: ${task.urgency}`}>
          {URGENCY_DOT[task.urgency]}
        </span>
        <div className="full-task-text-wrap">
          <span className="full-task-text">{task.text}</span>
          <div className="full-task-badges">
            <span className="task-time-badge">{getTimeEstimateShort(task.timeEstimate)}</span>
            {dreadVal != null && <span className="task-meta-badge">Dread: {dreadVal}</span>}
            {deadlineLabel && <span className="task-meta-badge task-deadline-badge">{deadlineLabel}</span>}
          </div>
        </div>
      </div>
      <div className="full-task-actions">
        {isDone ? (
          <button className="btn-undo-sm" onClick={() => onRestore(task.id)}>Undo</button>
        ) : (
          <button className="btn-done-sm" onClick={() => onComplete(task.id)}>✓</button>
        )}
        <button className="btn-delete-sm" onClick={() => onDelete(task.id)}>✕</button>
      </div>
    </li>
  )
}
