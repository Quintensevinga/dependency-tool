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

test('applicatieflow-tab toont hint als er geen applicaties zijn', async ({ page }) => {
  await openTeam(page, 'Team Freggels') // mock team zonder applicaties
  await page.click('button:has-text("Applicatieflow")')
  await page.waitForTimeout(300)
  await expect(page.locator('body')).toContainText('Voeg eerst applicaties toe')
})

test('koppeling toevoegen tekent meteen een edge op het canvas', async ({ page }) => {
  await openTeam(page, 'Team Equinox') // heeft 2 mock-applicaties
  await page.click('button:has-text("Applicatieflow")')
  await page.waitForTimeout(300)

  const edgesBefore = await page.locator('.react-flow__edge').count()
  await page.locator('select').filter({ hasText: 'Van' }).selectOption({ label: 'Kernbetaalmodule' })
  await page.locator('select').filter({ hasText: 'Naar' }).selectOption({ label: 'Integratielaag betalingen' })
  await page.click('button:has-text("+ Koppeling toevoegen")')
  await page.waitForTimeout(400)

  await expect(page.locator('.react-flow__edge')).toHaveCount(edgesBefore + 1)
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  expect(state.teamWorkflows['Team Equinox'].applicatieflow.connecties).toHaveLength(1)
})

test('detail toevoegen aan een applicatie synct direct en persisteert', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await page.click('button:has-text("Applicatieflow")')
  await page.waitForTimeout(300)

  await page.locator('.react-flow__node').first().locator('button:has-text("+ Detail toevoegen")').click()
  await page.waitForTimeout(200)
  await page.fill('textarea', 'Verwerkt alle betalingen voor de kernapplicatie.')
  const riskSelect = page.locator('.fixed select').first()
  await riskSelect.selectOption('ja')
  await page.waitForTimeout(150)
  await page.locator('.fixed input').first().fill('Enige applicatie die iDEAL-koppeling verzorgt')
  await page.click('button:has-text("Sluiten")')
  await page.waitForTimeout(300)

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  const details = Object.values(state.teamWorkflows['Team Equinox'].applicatieflow.details)
  expect(details.some((d) => d.risico_bij_uitval === 'ja')).toBe(true)

  // node should now show "Detail bewerken" instead of "+ Detail toevoegen"
  await expect(page.locator('.react-flow__node').first()).toContainText('Detail bewerken')
})

test('applicatieflow-koppeling overleeft team-switch en reload', async ({ page }) => {
  await openTeam(page, 'Team Equinox')
  await page.click('button:has-text("Applicatieflow")')
  await page.waitForTimeout(300)
  await page.locator('select').filter({ hasText: 'Van' }).selectOption({ label: 'Kernbetaalmodule' })
  await page.locator('select').filter({ hasText: 'Naar' }).selectOption({ label: 'Integratielaag betalingen' })
  await page.click('button:has-text("+ Koppeling toevoegen")')
  await page.waitForTimeout(300)

  await openTeam(page, 'Team Tiem')
  await openTeam(page, 'Team Equinox')
  await page.click('button:has-text("Applicatieflow")')
  await page.waitForTimeout(300)
  await expect(page.locator('body')).toContainText('Kernbetaalmodule')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)

  await page.reload()
  await openTeam(page, 'Team Equinox')
  await page.click('button:has-text("Applicatieflow")')
  await page.waitForTimeout(300)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
})
