import { test, expect } from '@playwright/test'

async function openTeam(page, name) {
  await page.click('[title="Teams"]')
  await page.waitForSelector('text=Teams')
  await page.click(`button:has-text("${name}")`)
  await page.waitForTimeout(400)
  // Onboarding-rondleiding start automatisch bij het eerste bezoek in een
  // vers browserprofiel (elke test krijgt er één) — wegklikken zodat andere
  // tests niet worden geblokkeerd door de overlay.
  const skipTour = page.locator('button:has-text("Overslaan")')
  if (await skipTour.count()) await skipTour.click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('text=Dependency Insight')
})

test('team wisselen remount de teampagina volledig (geen restjes UI-state)', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await page.click('button:has-text("🖇 Lijn")')
  await expect(page.locator('text=Klik twee elementen')).toBeVisible()

  await openTeam(page, 'Team Tiem')
  await expect(page.locator('text=Klik twee elementen')).toHaveCount(0)
})

test('terug-knop en tab-klik verlaten de teampagina', async ({ page }) => {
  await openTeam(page, 'Team Casio')
  await page.click('button:has-text("← Terug naar overzicht")')
  await page.waitForTimeout(200)
  await expect(page.locator('button:has-text("← Terug naar overzicht")')).toHaveCount(0)

  await openTeam(page, 'Team Casio')
  await page.click('text=Netwerkweergave')
  await page.waitForTimeout(200)
  await expect(page.locator('button:has-text("← Terug naar overzicht")')).toHaveCount(0)
})

test('wis teampagina leegt de workflow maar behoudt dependencies', async ({ page }) => {
  await openTeam(page, 'Team Casio')
  const depsBefore = await page.evaluate(
    () => JSON.parse(localStorage.getItem('dependency-insight:v1')).dependencies.filter((d) => d.team === 'Team Casio').length,
  )
  expect(depsBefore).toBeGreaterThan(0)

  let dialogMessage = ''
  page.once('dialog', (d) => {
    dialogMessage = d.message()
    d.accept()
  })
  await page.click('button:has-text("Wis teampagina")')
  await page.waitForTimeout(300)

  expect(dialogMessage).toContain('applicaties')

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  const wf = state.teamWorkflows['Team Casio']
  expect(wf.inputs).toHaveLength(0)
  expect(wf.capacity).toHaveLength(0)
  expect(wf.outputs).toHaveLength(0)
  const depsAfter = state.dependencies.filter((d) => d.team === 'Team Casio').length
  expect(depsAfter).toBe(depsBefore)
})

test('dubbele teamnaam wordt niet twee keer toegevoegd', async ({ page }) => {
  await page.click('[title="Teams"]')
  await page.click('button:has-text("+ Team")')
  await page.fill('input[placeholder*="Naam nieuw team"]', 'E2E Dup Team')
  await page.click('button:has-text("Toevoegen")')
  await page.waitForTimeout(300)
  await page.click('div.fixed.inset-0 button:has-text("✕")')
  await page.waitForTimeout(200)

  await page.click('[title="Teams"]')
  await page.click('button:has-text("+ Team")')
  await page.fill('input[placeholder*="Naam nieuw team"]', 'E2E Dup Team')
  await page.click('button:has-text("Toevoegen")')
  await page.waitForTimeout(300)

  const teams = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')).teams)
  expect(teams.filter((t) => t === 'E2E Dup Team')).toHaveLength(1)
})
