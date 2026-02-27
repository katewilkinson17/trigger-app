import { useState, useEffect } from 'react'

const STORAGE_KEY = 'trigger_tasks'
const HISTORY_KEY = 'trigger_history'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function useTasks() {
  const [tasks, setTasks] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const all = raw ? JSON.parse(raw) : []

      // Archive any done tasks completed before today into history log (daily reset)
      const todayStr = new Date().toDateString()
      const toArchive = all.filter(
        t => t.done && (!t.completedAt || new Date(t.completedAt).toDateString() !== todayStr)
      )
      if (toArchive.length > 0) {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
        localStorage.setItem(HISTORY_KEY, JSON.stringify([...history, ...toArchive]))
        return all.filter(t => !toArchive.some(a => a.id === t.id))
      }
      return all
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  function addTask({ text, urgency, dread, timeEstimate, familiar, deadline }) {
    const task = {
      id: generateId(),
      text,
      urgency,
      dread,
      timeEstimate,
      familiar,
      deadline: deadline ?? null,
      done: false,
      createdAt: Date.now(),
    }
    setTasks(prev => [task, ...prev])
    return task
  }

  function completeTask(id) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: true, completedAt: Date.now() } : t))
  }

  function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function restoreTask(id) {
    // Clear completedAt so the task isn't immediately re-archived on next load
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: false, completedAt: null } : t))
  }

  return { tasks, addTask, completeTask, deleteTask, restoreTask }
}
