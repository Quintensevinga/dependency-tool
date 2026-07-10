import { MOCK_TEAMS, MOCK_DEPENDENCIES } from '../data/mockData'

const STORAGE_KEY = 'dependency-insight:v1'

function emptyState() {
  return {
    teams: [],
    dependencies: [],
    usingMockData: false,
  }
}

function mockState() {
  return {
    teams: [...MOCK_TEAMS],
    dependencies: MOCK_DEPENDENCIES.map((d) => ({ ...d })),
    usingMockData: true,
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const initial = mockState()
      saveState(initial)
      return initial
    }
    const parsed = JSON.parse(raw)
    return {
      teams: Array.isArray(parsed.teams) ? parsed.teams : [],
      dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies : [],
      usingMockData: Boolean(parsed.usingMockData),
    }
  } catch {
    return mockState()
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function resetToEmpty() {
  const state = emptyState()
  saveState(state)
  return state
}

export function resetToMockData() {
  const state = mockState()
  saveState(state)
  return state
}

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `dep-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
