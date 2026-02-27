// Time estimate labels and ordering
export const TIME_ESTIMATES = [
  { value: 'under5',  label: 'Under 5 min',  short: '< 5m',  minutes: 5 },
  { value: '5to15',   label: '5 – 15 min',   short: '5–15m', minutes: 15 },
  { value: '15to30',  label: '15 – 30 min',  short: '15–30m',minutes: 30 },
  { value: 'longer',  label: '30+ min',       short: '30m+',  minutes: 999 },
]

export const TIME_ORDER = ['under5', '5to15', '15to30', 'longer']

// Which estimates fit within a given available-minutes budget
const FITS_IN = {
  5:   ['under5'],
  15:  ['under5', '5to15', '15to30'],
  30:  ['under5', '5to15', '15to30'],
  999: ['under5', '5to15', '15to30', 'longer'],
}

export const TIME_SLOTS = [
  { label: '5 min',  minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hr+',  minutes: 999 },
]

export function getTimeEstimateLabel(value) {
  return TIME_ESTIMATES.find(t => t.value === value)?.label ?? value
}

export function getTimeEstimateShort(value) {
  return TIME_ESTIMATES.find(t => t.value === value)?.short ?? value
}

// AI time estimate: keyword + length heuristic, bumped one level for novel (unfamiliar) tasks
export function aiTimeEstimate(text, familiar = true) {
  const lower = text.toLowerCase()
  const quickWords = ['reply', 'email', 'call', 'text', 'message', 'check', 'read', 'pay', 'book', 'schedule', 'remind']
  const longWords  = ['write', 'create', 'build', 'plan', 'research', 'review', 'prepare', 'organize', 'clean', 'fix', 'update']

  let base
  if (quickWords.some(w => lower.includes(w)) || text.length < 30) base = 'under5'
  else if (longWords.some(w => lower.includes(w)) || text.length > 80) base = '15to30'
  else base = '5to15'

  // Novel-task penalty: bump up one level
  if (!familiar) {
    const idx = TIME_ORDER.indexOf(base)
    base = TIME_ORDER[Math.min(idx + 1, 3)]
  }
  return base
}

// Derive urgency from deadline (1=low, 2=medium, 3=high)
export function deriveUrgency(deadline) {
  if (!deadline) return 1
  if (deadline === 'today' || deadline === 'tomorrow') return 3
  if (deadline === 'inAFewDays') return 2
  // backwards compat
  if (deadline === 'thisWeek') return 2
  if (deadline === 'thisMonth') return 1
  if (deadline?.date) {
    const daysLeft = (new Date(deadline.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (daysLeft <= 1) return 3
    if (daysLeft <= 7) return 2
    return 1
  }
  return 1
}

// Deadline urgency boost — recomputed fresh every render so it escalates automatically
export function getDeadlineBoost(deadline) {
  if (!deadline) return 0
  const now = Date.now()
  let dueMs

  if (deadline === 'today') {
    const d = new Date()
    d.setHours(23, 59, 59, 0)
    dueMs = d.getTime()
  } else if (deadline === 'tomorrow') {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(23, 59, 59, 0)
    dueMs = d.getTime()
  } else if (deadline === 'inAFewDays') {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    d.setHours(23, 59, 59, 0)
    dueMs = d.getTime()
  } else if (deadline === 'thisWeek') {
    // backwards compat
    const d = new Date()
    d.setDate(d.getDate() + (7 - d.getDay()))
    d.setHours(23, 59, 59, 0)
    dueMs = d.getTime()
  } else if (deadline === 'thisMonth') {
    // backwards compat
    const d = new Date()
    d.setMonth(d.getMonth() + 1, 0)
    d.setHours(23, 59, 59, 0)
    dueMs = d.getTime()
  } else if (deadline?.date) {
    dueMs = new Date(deadline.date).getTime()
  } else {
    return 0
  }

  const daysLeft = (dueMs - now) / (1000 * 60 * 60 * 24)
  if (daysLeft < 0)   return 20  // overdue
  if (daysLeft <= 1)  return 15
  if (daysLeft <= 3)  return 10
  if (daysLeft <= 7)  return 6
  if (daysLeft <= 14) return 3
  if (daysLeft <= 30) return 1
  return 0
}

// Priority score — backwards-compatible with old anxiety field (1-3) and new dread field (0-10)
export function priorityScore(task) {
  const ageDays    = (Date.now() - (task.createdAt ?? 0)) / (1000 * 60 * 60 * 24)
  const dreadScore = task.dread != null
    ? task.dread * 0.6          // 0-10 → 0-6
    : (task.anxiety ?? 0) * 2   // legacy 1-3 → 2-6
  return task.urgency * 4 + dreadScore + Math.min(ageDays, 7) + getDeadlineBoost(task.deadline)
}

// Surface the best tasks for available time, sorted by priority score
export function getSurfacedTasks(tasks, availableMinutes, limit = 3) {
  const allowed = FITS_IN[availableMinutes] ?? FITS_IN[999]
  const active = tasks.filter(t => !t.done && allowed.includes(t.timeEstimate))
  active.sort((a, b) => priorityScore(b) - priorityScore(a))
  return active.slice(0, limit)
}
