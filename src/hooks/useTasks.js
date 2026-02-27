import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { priorityScore } from '../utils/taskUtils'

// ── Shape mapping ─────────────────────────────────────────────────────────────
// DB uses snake_case columns; the app keeps the same camelCase shape as before
// so no other component changes are needed.

function dbToTask(row) {
  return {
    id:           row.id,
    text:         row.title,
    urgency:      row.urgency_score,
    dread:        row.dread_score,
    timeEstimate: row.time_estimate,
    familiar:     row.is_familiar,
    deadline:     row.deadline,          // jsonb — already parsed by Supabase client
    done:         row.completed_at !== null,
    createdAt:    new Date(row.created_at).getTime(),
    completedAt:  row.completed_at ? new Date(row.completed_at).getTime() : null,
  }
}

function taskToDb(task, userId) {
  return {
    user_id:        userId,
    title:          task.text,
    urgency_score:  task.urgency,
    dread_score:    task.dread,
    time_estimate:  task.timeEstimate,
    is_familiar:    task.familiar ?? true,
    deadline:       task.deadline ?? null,
    priority_score: priorityScore(task),
  }
}

function todayStartISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useTasks(userId) {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const pendingIds            = useRef(new Set()) // temp IDs for in-flight optimistic rows
  const tasksRef              = useRef(tasks)
  tasksRef.current = tasks

  async function fetchTasks() {
    if (!userId) return
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      // Active tasks OR tasks completed today (replaces localStorage daily-reset logic)
      .or(`completed_at.is.null,completed_at.gte.${todayStartISO()}`)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTasks(prev => {
        // Keep any in-flight optimistic rows; fill the rest from the server
        const optimistic = prev.filter(t => pendingIds.current.has(t.id))
        const fromServer = data.map(dbToTask).filter(t => !pendingIds.current.has(t.id))
        return [...optimistic, ...fromServer]
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    fetchTasks()

    // Re-fetch when the tab regains focus for cross-device sync
    function onVisible() {
      if (document.visibilityState === 'visible') fetchTasks()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId])

  // ── Mutations (optimistic-first) ────────────────────────────────────────────

  async function addTask({ text, urgency, dread, timeEstimate, familiar, deadline }) {
    const tempId = crypto.randomUUID()
    const now    = Date.now()
    const optimistic = {
      id: tempId, text, urgency, dread, timeEstimate, familiar,
      deadline: deadline ?? null,
      done: false, createdAt: now, completedAt: null,
    }
    pendingIds.current.add(tempId)
    setTasks(prev => [optimistic, ...prev])

    const { data, error } = await supabase
      .from('tasks')
      .insert(taskToDb(optimistic, userId))
      .select()
      .single()

    pendingIds.current.delete(tempId)

    if (!error && data) {
      setTasks(prev => prev.map(t => t.id === tempId ? dbToTask(data) : t))
    } else {
      // Rollback on failure
      setTasks(prev => prev.filter(t => t.id !== tempId))
    }
  }

  async function completeTask(id) {
    const now = new Date().toISOString()
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, done: true, completedAt: Date.now() } : t
    ))
    const task = tasksRef.current.find(t => t.id === id)
    await supabase
      .from('tasks')
      .update({ completed_at: now, priority_score: task ? priorityScore(task) : null })
      .eq('id', id)
  }

  async function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  async function restoreTask(id) {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, done: false, completedAt: null } : t
    ))
    await supabase.from('tasks').update({ completed_at: null }).eq('id', id)
  }

  return { tasks, loading, addTask, completeTask, deleteTask, restoreTask }
}
