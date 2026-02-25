import { useState } from 'react'
import { useTasks } from './hooks/useTasks'
import Widget from './components/Widget'
import TaskList from './components/TaskList'
import TaskForm from './components/TaskForm'
import './styles/global.css'

export default function App() {
  const { tasks, addTask, completeTask, deleteTask, restoreTask } = useTasks()
  const [view, setView] = useState('home') // 'home' | 'list'
  const [showForm, setShowForm] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedCount, setSavedCount] = useState(1)

  function handleSave(data) {
    if (Array.isArray(data)) {
      data.forEach(task => addTask(task))
      setSavedCount(data.length)
    } else {
      addTask(data)
      setSavedCount(1)
    }
    setShowForm(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const activeTasks = tasks.filter(t => !t.done)
  const isEmpty = activeTasks.length === 0 && view === 'home'

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <span className="app-logo">Trigger</span>
        {activeTasks.length > 0 && (
          <span className="task-count">{activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''}</span>
        )}
      </header>

      {/* Main content */}
      <main className={`app-main${isEmpty ? ' app-main-empty' : ''}`}>
        {view === 'home' ? (
          <Widget
            tasks={tasks}
            onComplete={completeTask}
            onDump={() => setShowForm(true)}
          />
        ) : (
          <TaskList
            tasks={tasks}
            onComplete={completeTask}
            onDelete={deleteTask}
            onRestore={restoreTask}
          />
        )}
      </main>

      {/* Saved toast */}
      {saved && (
        <div className="toast">
          {savedCount > 1 ? `${savedCount} tasks saved ✓` : 'Task saved ✓'}
        </div>
      )}

      {/* Dump button */}
      <div className={`dump-area${isEmpty ? ' expanded' : ''}`}>
        <button
          className={`dump-btn${isEmpty ? ' expanded' : ''}`}
          onClick={() => setShowForm(true)}
          aria-label="Add new task"
        >
          + Dump It
        </button>
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        <button
          className={`nav-btn${view === 'home' ? ' active' : ''}`}
          onClick={() => setView('home')}
        >
          <span className="nav-icon">◉</span>
          <span>Now</span>
        </button>
        <button
          className={`nav-btn${view === 'list' ? ' active' : ''}`}
          onClick={() => setView('list')}
        >
          <span className="nav-icon">≡</span>
          <span>All Tasks</span>
        </button>
      </nav>

      {/* Task form overlay */}
      {showForm && (
        <TaskForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
