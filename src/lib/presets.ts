// The standard 75 Hard daily rules (Andy Frisella's program), used as the default task list.
export type TaskDraft = { key: string; title: string; detail: string }

export const PRESET_TASKS: ReadonlyArray<Omit<TaskDraft, 'key'>> = [
  { title: 'Follow a diet', detail: 'No cheat meals. No alcohol.' },
  { title: 'Workout #1', detail: '45 minutes' },
  { title: 'Workout #2 (outdoors)', detail: '45 minutes, outside, any weather' },
  { title: 'Drink a gallon of water', detail: '1 gallon (3.8 L)' },
  { title: 'Read 10 pages', detail: 'Non-fiction or self-improvement' },
  { title: 'Take a progress photo', detail: 'Every day, no skipping' },
]

let seq = 0
export const newKey = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`

export const presetDrafts = (): TaskDraft[] => PRESET_TASKS.map((t) => ({ ...t, key: newKey() }))

export const LIMITS = { name: 40, title: 60, detail: 120, maxTasks: 12, displayName: 40 } as const
