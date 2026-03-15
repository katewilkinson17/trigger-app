import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTasks } from './hooks/useTasks'
import Widget from './components/Widget'
import TaskList from './components/TaskList'
import TaskForm from './components/TaskForm'
import DoMode from './components/DoMode'
import CelebrationOverlay from './components/CelebrationOverlay'
import PhotoViewer from './components/PhotoViewer'
import './styles/global.css'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { tasks, loading: tasksLoading, addTask, completeTask, deleteTask, restoreTask, saveError } = useTasks(user?.id)

  const [view, setView]         = useState('home') // 'home' | 'list'
  const [showForm, setShowForm] = useState(false)
  const [saved, setSaved]       = useState(false)
  const [savedCount, setSavedCount] = useState(1)
  const [doTask, setDoTask]     = useState(null)
  const [celebratingTask, setCelebratingTask] = useState(null)
  const [viewingPhoto, setViewingPhoto]       = useState(null)

  // Show a full-page spinner only while the initial task list loads (after auth).
  // During auth init (~1-2s) we keep the shell visible but disable the Dump button
  // so users never hit the "Sign-in not ready" error from useTasks.addTask.
  if (!authLoading && tasksLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
      </div>
    )
  }

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

  function handleComplete(id) {
    if (navigator.vibrate) navigator.vibrate(50)
    const task = tasks.find(t => t.id === id)
    completeTask(id)
    setCelebratingTask(task ?? { text: '' })
    setTimeout(() => setCelebratingTask(null), 1800)
  }

  const activeTasks = tasks.filter(t => !t.done)
  const isEmpty = activeTasks.length === 0 && view === 'home'

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">Trigger</span>
      </header>

      <main className={`app-main${isEmpty ? ' app-main-empty' : ''}`}>
        {view === 'home' ? (
          <Widget
            tasks={tasks}
            onComplete={handleComplete}
            onDump={() => { if (!authLoading) setShowForm(true) }}
            onDo={task => setDoTask(task)}
          />
        ) : (
          <TaskList
            tasks={tasks}
            onComplete={handleComplete}
            onDelete={deleteTask}
            onRestore={restoreTask}
            onViewPhoto={url => setViewingPhoto(url)}
          />
        )}
      </main>

      {saved && (
        <div className="toast">
          {savedCount > 1 ? `${savedCount} tasks saved ✓` : 'Task saved ✓'}
        </div>
      )}

      {saveError && (
        <div className="toast toast-error">
          ⚠ {saveError}
        </div>
      )}

      <div className={`dump-area${isEmpty ? ' expanded' : ''}`}>
        <button
          className={`dump-btn${isEmpty ? ' expanded' : ''}${authLoading ? ' dump-btn-auth-loading' : ''}`}
          onClick={() => setShowForm(true)}
          disabled={authLoading}
          aria-label="Add new task"
        >
          {authLoading ? 'Loading…' : '+ Dump It'}
        </button>
      </div>

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

      {showForm && (
        <TaskForm
          userId={user?.id}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {doTask && (
        <DoMode
          task={doTask}
          onDone={() => { completeTask(doTask.id); setDoTask(null) }}
          onSnooze={() => setDoTask(null)}
        />
      )}

      {celebratingTask && (
        <CelebrationOverlay taskText={celebratingTask.text} />
      )}

      {viewingPhoto && (
        <PhotoViewer
          url={viewingPhoto}
          onClose={() => setViewingPhoto(null)}
        />
      )}
    </div>
  )
}
