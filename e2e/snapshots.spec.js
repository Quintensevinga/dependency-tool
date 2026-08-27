import { test, expect } from '@playwright/test'

async function openTeam(page, name) {
  await page.click('[title="Teams"]')
  await page.waitForSelector('text=Teams')
  await page.click(`button:has-text("${name}")`)
  await page.waitForTimeout(400)
  const skipTour = page.locator('button:has-text("Overslaan")')
  if (await skipTour.count()) await skipTour.click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('text=Dependency Insight')
})

test('momentopname opslaan, hernoemen en teruglezen uit localStorage', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await page.click('button:has-text("Momentopnamen")')
  await page.waitForTimeout(200)
  await page.click('button:has-text("+ Bewaar huidige stand")')
  await page.waitForTimeout(300)

  let state = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  let snaps = state.teamSnapshots['Team Equinox']
  expect(snaps).toHaveLength(1)
  expect(snaps[0].naam).toBe('Momentopname 1')
  expect(snaps[0].data.applications.some((a) => a.naam === 'Kernbetaalmodule')).toBe(true)

  const snapshotPanel = page.locator('div', { has: page.getByRole('button', { name: '+ Bewaar huidige stand' }) }).last()
  await snapshotPanel.locator('input').first().fill('Voor demo maandag')
  await page.waitForTimeout(200)
  state = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  expect(state.teamSnapshots['Team Equinox'][0].naam).toBe('Voor demo maandag')
})

test('momentopname laden overschrijft de huidige workflow', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await page.click('button:has-text("Momentopnamen")')
  await page.waitForTimeout(200)
  await page.click('button:has-text("+ Bewaar huidige stand")')
  await page.waitForTimeout(300)
  await page.click('button:has-text("✕")') // close snapshots panel

  // mutate current workflow: add an application
  await page.click('button:has-text("+ Applicatie toevoegen")')
  await page.waitForTimeout(200)
  const appInputs = page.locator('input[placeholder*="Kernbetaalmodule"]')
  await appInputs.last().fill('Tijdelijke test-app')
  await page.waitForTimeout(300)

  let state = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  expect(state.teamWorkflows['Team Equinox'].applications.some((a) => a.naam === 'Tijdelijke test-app')).toBe(true)

  // restore the snapshot taken before the mutation
  await page.click('button:has-text("Momentopnamen")')
  await page.waitForTimeout(200)
  page.once('dialog', (d) => d.accept())
  await page.click('button:has-text("Laden")')
  await page.waitForTimeout(300)

  state = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  expect(state.teamWorkflows['Team Equinox'].applications.some((a) => a.naam === 'Tijdelijke test-app')).toBe(false)
})

test('maximaal 10 momentopnamen per team, oudste rolt eruit', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await page.click('button:has-text("Momentopnamen")')
  await page.waitForTimeout(200)
  for (let i = 0; i < 11; i++) {
    await page.click('button:has-text("+ Bewaar huidige stand")')
    await page.waitForTimeout(150)
  }
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  const snaps = state.teamSnapshots['Team Equinox']
  expect(snaps).toHaveLength(10)
  expect(snaps.some((s) => s.naam === 'Momentopname 1')).toBe(false)
  expect(snaps.some((s) => s.naam === 'Momentopname 11')).toBe(true)
})

test('momentopname verwijderen', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await page.click('button:has-text("Momentopnamen")')
  await page.waitForTimeout(200)
  await page.click('button:has-text("+ Bewaar huidige stand")')
  await page.waitForTimeout(300)
  await page.click('button:has-text("Verwijderen")')
  await page.waitForTimeout(300)
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  expect(state.teamSnapshots['Team Equinox']).toHaveLength(0)
})
