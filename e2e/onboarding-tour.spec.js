import { test, expect } from '@playwright/test'

async function openTeam(page, name) {
  await page.click('[title="Teams"]')
  await page.waitForSelector('text=Teams')
  await page.click(`button:has-text("${name}")`)
  await page.waitForTimeout(400)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('text=Dependency Insight')
})

test('rondleiding start automatisch bij eerste bezoek en niet daarna', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await page.waitForTimeout(300)
  await expect(page.locator('text=1 / 7')).toBeVisible()

  await page.click('button:has-text("Overslaan")')
  await page.waitForTimeout(200)
  await expect(page.locator('text=1 / 7')).toHaveCount(0)

  const seen = await page.evaluate(() => localStorage.getItem('dependency-insight:team-tour-seen'))
  expect(seen).toBe('1')

  // opnieuw naar teampagina -> geen automatische rondleiding meer
  await page.click('button:has-text("← Terug naar overzicht")')
  await openTeam(page, 'Team Tiem')
  await page.waitForTimeout(300)
  await expect(page.locator('text=1 / 7')).toHaveCount(0)
})

test('volgende/vorige navigeert door alle stappen en eindigt met Klaar', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await page.waitForTimeout(300)

  for (let i = 1; i <= 6; i++) {
    await expect(page.locator(`text=${i} / 7`)).toBeVisible()
    await page.click('button:has-text("Volgende")')
    await page.waitForTimeout(250)
  }
  await expect(page.locator('text=7 / 7')).toBeVisible()
  await expect(page.locator('button:has-text("Klaar")')).toBeVisible()

  await page.click('button:has-text("Vorige")')
  await page.waitForTimeout(200)
  await expect(page.locator('text=6 / 7')).toBeVisible()
  await expect(page.locator('button:has-text("Volgende")')).toBeVisible()
})

test('rondleiding-knop start de tour opnieuw, ook vanaf het applicatieflow-tabblad', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await page.click('button:has-text("Overslaan")')
  await page.waitForTimeout(200)

  await page.click('button:has-text("Applicatieflow")')
  await page.waitForTimeout(200)
  await page.click('button:has-text("? Rondleiding")')
  await page.waitForTimeout(300)

  // startTour forceert terug naar het workflow-tabblad zodat stap 1 iets kan tonen
  await expect(page.locator('text=1 / 7')).toBeVisible()
  await expect(page.locator('button:has-text("Workflow")')).toHaveClass(/text-\[#33493c\]/)
})
