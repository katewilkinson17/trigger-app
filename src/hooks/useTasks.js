import { useState, useEffect } from 'react'

const STORAGE_KEY = 'trigger_tasks'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function useTasks() {
  const [tasks, setTasks] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  function addTask({ text, urgency, anxiety, timeEstimate }) {
    const task = {
      id: generateId(),
      text,
      urgency,
      anxiety,
      timeEstimate,
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
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: false } : t))
  }

  return { tasks, addTask, completeTask, deleteTask, restoreTask }
}
