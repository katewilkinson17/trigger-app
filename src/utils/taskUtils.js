// Time estimate labels and ordering
export const TIME_ESTIMATES = [
  { value: 'under5',  label: 'Under 5 min',  short: '< 5m',  minutes: 5 },
  { value: '5to15',   label: '5 – 15 min',   short: '5–15m', minutes: 15 },
  { value: '15to30',  label: '15 – 30 min',  short: '15–30m',minutes: 30 },
  { value: 'longer',  label: '30+ min',       short: '30m+',  minutes: 999 },
]

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

// Surface the best tasks for available time
// Sort: urgency desc, then anxiety asc (lower anxiety = easier to start)
export function getSurfacedTasks(tasks, availableMinutes, limit = 3) {
  const allowed = FITS_IN[availableMinutes] ?? FITS_IN[999]
  const active = tasks.filter(t => !t.done && allowed.includes(t.timeEstimate))
  active.sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency
    return a.anxiety - b.anxiety
  })
  return active.slice(0, limit)
}

// Auto-suggest a time estimate based on task text length / keywords
export function suggestTimeEstimate(text) {
  const lower = text.toLowerCase()
  const quickWords = ['reply', 'email', 'call', 'text', 'message', 'check', 'read', 'pay', 'book', 'schedule', 'remind']
  const longWords = ['write', 'create', 'build', 'plan', 'research', 'review', 'prepare', 'organize', 'clean', 'fix', 'update']

  if (quickWords.some(w => lower.includes(w)) || text.length < 30) return 'under5'
  if (longWords.some(w => lower.includes(w)) || text.length > 80) return '15to30'
  return '5to15'
}
