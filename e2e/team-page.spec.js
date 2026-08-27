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

test('teampagina opent en toont workflow-canvas met 7 fasen', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await expect(page.locator('h2:has-text("Team Equinox")')).toBeVisible()
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Analyse/refinement' })).toHaveCount(1)
})

test('applicaties: mock data zichtbaar, toevoegen en verwijderen werkt', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  const appInputs = page.locator('input[placeholder*="Kernbetaalmodule"]')
  await expect(appInputs.first()).toHaveValue('Kernbetaalmodule')
  const before = await appInputs.count()

  await page.click('button:has-text("+ Applicatie toevoegen")')
  await page.waitForTimeout(200)
  await expect(appInputs).toHaveCount(before + 1)

  await page.locator('button:has-text("Verwijderen")').first().click()
  await page.waitForTimeout(200)
  await expect(page.locator('input[placeholder*="Kernbetaalmodule"]')).toHaveCount(before)
})

test('input bron_type kleurt het canvasblokje', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  const bronSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Stakeholder' }) }).first()
  await bronSelect.selectOption({ label: 'Stakeholder' })
  await page.waitForTimeout(300)
  const color = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.react-flow__node')]
    const inputNode = nodes.find((n) => n.dataset.id?.startsWith('input:'))
    return inputNode ? getComputedStyle(inputNode.querySelector('div')).borderLeftColor : null
  })
  expect(color).toBe('rgb(199, 122, 148)')
})

test('capaciteit: rol-dropdown, senioriteit en eigen rol toevoegen', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await expect(page.locator('body')).toContainText('Scrum master')
  await expect(page.locator('body')).toContainText('Senior')

  await page.click('button:has-text("+ Rol toevoegen")')
  await page.waitForTimeout(200)
  const roleSelects = page.locator('select').filter({ has: page.locator('option', { hasText: '+ Nieuwe rol toevoegen' }) })
  await roleSelects.last().selectOption({ label: '+ Nieuwe rol toevoegen' })
  await page.waitForTimeout(150)
  await page.locator('input[placeholder*="Senior tester"]').fill('E2E Custom Rol')
  await page.getByRole('button', { name: 'Toevoegen', exact: true }).click()
  await page.waitForTimeout(300)

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  expect(stored.customRoles).toContain('E2E Custom Rol')
})

test('capaciteit met workflow-fase en dependency met workflow_fase verschijnen als canvas-badges', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  const capacityBadges = await page.evaluate(() => document.querySelectorAll('[data-id^="capacity:"]').length)
  const depMarkers = await page.evaluate(() => document.querySelectorAll('.react-flow__node[data-id^="dependency:"]').length)
  expect(capacityBadges).toBeGreaterThan(0)
  expect(depMarkers).toBeGreaterThan(0)
})

test('leeg team toont correcte lege-staat teksten (geen crash)', async ({ page }) => {
  await page.click('[title="Teams"]')
  await page.click('button:has-text("+ Team")')
  await page.fill('input[placeholder*="Naam nieuw team"]', 'E2E Leeg Team')
  await page.click('button:has-text("Toevoegen")')
  await page.waitForTimeout(300)
  await page.click('div.fixed.inset-0 button:has-text("✕")')
  await page.waitForTimeout(200)

  await openTeam(page, 'E2E Leeg Team')
  await expect(page.locator('body')).toContainText('Nog geen capaciteit vastgelegd')
  await expect(page.locator('body')).toContainText('Nog geen applicaties vastgelegd')
  await expect(page.locator('body')).toContainText('Nog geen dependencies vastgelegd')
  await expect(page.locator('.react-flow__node')).toHaveCount(7)
})
