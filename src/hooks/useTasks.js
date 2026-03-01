import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { priorityScore, getNextOccurrenceDate, getRecurrenceBuffer } from '../utils/taskUtils'

// ── Shape mapping ─────────────────────────────────────────────────────────────

function dbToTask(row) {
  return {
    id:             row.id,
    text:           row.title,
    urgency:        row.urgency_score,
    dread:          row.dread_score,
    timeEstimate:   row.time_estimate,
    familiar:       row.is_familiar,
    deadline:       row.deadline,
    done:           row.completed_at !== null,
    createdAt:      new Date(row.created_at).getTime(),
    completedAt:    row.completed_at ? new Date(row.completed_at).getTime() : null,
    photoUrl:       row.photo_url    ?? null,
    locationTag:    row.location_tag ?? null,
    recurrenceRule: row.recurrence_rule ? JSON.parse(row.recurrence_rule) : null,
  }
}

function taskToDb(task, userId) {
  const row = {
    user_id:         userId,
    title:           task.text,
    urgency_score:   task.urgency,
    dread_score:     task.dread,
    time_estimate:   task.timeEstimate,
    is_familiar:     task.familiar ?? true,
    deadline:        task.deadline  ?? null,
    priority_score:  priorityScore(task),
    photo_url:       task.photoUrl       ?? null,
    location_tag:    task.locationTag    ?? null,
    recurrence_rule: task.recurrenceRule ? JSON.stringify(task.recurrenceRule) : null,
  }
  // Only include show_after when set — this column requires migration 002.
  // Omitting it (rather than passing null) avoids a DB error if the migration
  // hasn't been run yet, keeping basic task-saving working regardless.
  if (task.showAfter) row.show_after = task.showAfter
  return row
}

function todayStartISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// Pre-seed two example recurring tasks so the user can see the feature in action.
async function seedRecurringTasks(userId) {
  const now = new Date()

  // Next 1st of the month (could be this month if today < 1st — always next month to be safe)
  const rent1st = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  // Next Friday
  const nextFriday = new Date(now)
  const daysUntilFri = (5 - now.getDay() + 7) % 7 || 7
  nextFriday.setDate(now.getDate() + daysUntilFri)
  const nextFridayStr = nextFriday.toISOString().split('T')[0]

  const seeds = [
    {
      user_id:         userId,
      title:           'Pay rent',
      urgency_score:   2,
      dread_score:     3,
      time_estimate:   'under5',
      is_familiar:     true,
      deadline:        { date: rent1st.toISOString().split('T')[0] },
      priority_score:  5,
      recurrence_rule: JSON.stringify({ type: 'monthly', dayOfMonth: 1 }),
      // show_after null → visible immediately as a demo example
    },
    {
      user_id:         userId,
      title:           'Submit timesheet',
      urgency_score:   2,
      dread_score:     2,
      time_estimate:   'under5',
      is_familiar:     true,
      deadline:        { date: nextFridayStr },
      priority_score:  5,
      recurrence_rule: JSON.stringify({ type: 'weekly', dayOfWeek: 5 }),
    },
  ]

  await supabase.from('tasks').insert(seeds)
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useTasks(userId) {
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [saveError, setSaveError] = useState(null)
  const pendingIds              = useRef(new Set())
  const tasksRef                = useRef(tasks)
  tasksRef.current = tasks

  async function fetchTasks(firstLoad = false) {
    if (!userId) return
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .or(`completed_at.is.null,completed_at.gte.${todayStartISO()}`)
      .order('created_at', { ascending: false })

    if (!error && data) {
      // Client-side filter: hide future recurring tasks that aren't ready yet
      const now = new Date()
      const visible = data.filter(row =>
        !row.show_after || new Date(row.show_after) <= now
      )

      setTasks(prev => {
        const optimistic  = prev.filter(t => pendingIds.current.has(t.id))
        const fromServer  = visible.map(dbToTask).filter(t => !pendingIds.current.has(t.id))
        return [...optimistic, ...fromServer]
      })

      // Seed example recurring tasks the very first time this user has no tasks
      if (firstLoad && data.length === 0) {
        await seedRecurringTasks(userId)
        // Re-fetch to show seeds
        const { data: seeded } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false })
        if (seeded) setTasks(seeded.map(dbToTask))
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    fetchTasks(true)

    function onVisible() {
      if (document.visibilityState === 'visible') fetchTasks(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId])

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function addTask({ text, urgency, dread, timeEstimate, familiar, deadline,
                           photoUrl, locationTag, recurrenceRule }) {
    const tempId = crypto.randomUUID()
    const now    = Date.now()
    const optimistic = {
      id: tempId, text, urgency, dread, timeEstimate, familiar,
      deadline: deadline ?? null,
      done: false, createdAt: now, completedAt: null,
      photoUrl:       photoUrl       ?? null,
      locationTag:    locationTag    ?? null,
      recurrenceRule: recurrenceRule ?? null,
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
      setSaveError(null)
      setTasks(prev => prev.map(t => t.id === tempId ? dbToTask(data) : t))
    } else {
      console.error('addTask insert failed:', error)
      setSaveError(error?.message ?? 'Save failed — check your connection')
      setTasks(prev => prev.filter(t => t.id !== tempId))
    }
  }

  async function completeTask(id) {
    const now  = new Date().toISOString()
    const task = tasksRef.current.find(t => t.id === id)

    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, done: true, completedAt: Date.now() } : t
    ))
    await supabase
      .from('tasks')
      .update({ completed_at: now, priority_score: task ? priorityScore(task) : null })
      .eq('id', id)

    // Auto-create next occurrence for recurring tasks
    if (task?.recurrenceRule) {
      const nextDateStr = getNextOccurrenceDate(task.recurrenceRule)
      if (nextDateStr) {
        const bufferDays = getRecurrenceBuffer(task.recurrenceRule)
        const showAfter  = new Date(nextDateStr)
        showAfter.setDate(showAfter.getDate() - bufferDays)

        const nextTask = {
          text:           task.text,
          urgency:        1,
          dread:          task.dread,
          timeEstimate:   task.timeEstimate,
          familiar:       task.familiar,
          deadline:       { date: nextDateStr },
          locationTag:    task.locationTag,
          recurrenceRule: task.recurrenceRule,
          showAfter:      showAfter.toISOString(),
        }
        await supabase.from('tasks').insert(taskToDb(nextTask, userId))
      }
    }
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

  return { tasks, loading, saveError, addTask, completeTask, deleteTask, restoreTask }
}
