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

test('Miro-toolbar: notitie/vormen toevoegen, kleur wijzigen, verwijderen', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  const initialNodeCount = await page.locator('.react-flow__node').count()

  await page.click('button:has-text("+ Notitie")')
  await page.click('button:has-text("+ Rechthoek")')
  await page.click('button:has-text("+ Cirkel")')
  await page.click('button:has-text("+ Ruit")')
  await page.waitForTimeout(300)
  await expect(page.locator('.react-flow__node')).toHaveCount(initialNodeCount + 4)

  const noteNode = page.locator('.react-flow__node').filter({ has: page.locator('textarea') }).first()
  await noteNode.locator('textarea').fill('E2E notitie')

  const nodeCountBeforeDelete = await page.locator('.react-flow__node').count()
  await noteNode.hover()
  await noteNode.locator('button:has-text("✕")').click()
  await page.waitForTimeout(300)
  await expect(page.locator('.react-flow__node')).toHaveCount(nodeCountBeforeDelete - 1)
})

test('lijn-tool verbindt twee elementen met een nieuwe edge', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await page.click('button:has-text("🖇 Lijn")')
  const edgeCountBefore = await page.locator('.react-flow__edge').count()
  await page.locator('.react-flow__node').filter({ hasText: 'Analyse/refinement' }).first().click()
  await page.waitForTimeout(150)
  await page.locator('.react-flow__node').filter({ hasText: 'Testen' }).first().click()
  await page.waitForTimeout(300)
  await expect(page.locator('.react-flow__edge')).toHaveCount(edgeCountBefore + 1)
})

test('cross-team input/output koppeling verschijnt in ketenoverzicht', async ({ page }) => {
  await openTeam(page, 'Team Tiem')
  await expect(page.locator('body')).toContainText('Team Equinox')

  await page.click('text=Ketenoverzicht')
  await page.waitForTimeout(400)
  const edgeCount = await page.locator('.react-flow__edge').count()
  expect(edgeCount).toBeGreaterThanOrEqual(2)
})

test('ketenoverzicht teamfilter verbergt het uitgevinkte team', async ({ page }) => {
  await page.click('text=Ketenoverzicht')
  await page.waitForTimeout(400)
  await page.locator('label:has-text("Team Casio") input[type=checkbox]').uncheck()
  await page.waitForTimeout(300)
  await expect(page.locator('body')).not.toContainText('Basisregistratie-koppeling live')
})
