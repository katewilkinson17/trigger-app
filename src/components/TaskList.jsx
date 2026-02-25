import { getTimeEstimateShort } from '../utils/taskUtils'

const URGENCY_DOT = ['', '🟢', '🟡', '🔴']
const URGENCY_LABEL = ['', 'Low', 'Medium', 'High']

export default function TaskList({ tasks, onComplete, onDelete, onRestore }) {
  const active = tasks.filter(t => !t.done)
  const done = tasks.filter(t => t.done)

  return (
    <section className="task-list-view">
      <h2 className="section-title">All Tasks</h2>

      {active.length === 0 && done.length === 0 && (
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
              onComplete={onComplete}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <h3 className="section-subtitle">Done</h3>
          <ul className="full-task-list done-list">
            {done.map(task => (
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
            <span className="task-meta-badge">U:{task.urgency}</span>
            <span className="task-meta-badge">A:{task.anxiety}</span>
          </div>
        </div>
      </div>
      <div className="full-task-actions">
        {isDone ? (
          <button className="btn-ghost-sm" onClick={() => onRestore(task.id)}>Undo</button>
        ) : (
          <button className="btn-done-sm" onClick={() => onComplete(task.id)}>✓</button>
        )}
        <button className="btn-delete-sm" onClick={() => onDelete(task.id)}>✕</button>
      </div>
    </li>
  )
}
